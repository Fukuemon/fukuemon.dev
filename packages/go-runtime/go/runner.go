// Yaegi で訪問者の Go のコードを動かす処理。js/wasm に依らないので、手元の go test で確かめる。
package main

import (
	"errors"
	"fmt"
	"io"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/traefik/yaegi/interp"
	"github.com/traefik/yaegi/stdlib"
)

// Input は、JS の側から受け取る値である。
type Input struct {
	// Files は、ツールのルートからのパスと中身である。
	Files map[string]string `json:"files"`
	// Module は、ルートのディレクトリの import のパスである。
	Module string `json:"module"`
	// Mode は "run" か "test" である。
	Mode string `json:"mode"`
	// Package は、Mode が "test" のときに、テストを実行する package の import のパスである。
	Package string `json:"package"`
}

// newInterpreter は、訪問者のファイルだけを src/<Module>/ に置いたファイルシステムで、Yaegi を作る。
// symbol は stdlib.Symbols だけを渡す。syscall、unsafe、unrestricted を渡すと、ページの JS に届くコードを動かせるためである (ADR-0063)。
func newInterpreter(in Input, stdout, stderr io.Writer) (*interp.Interpreter, error) {
	stderr = relativeWriter{stderr, in.Module}
	files := fstest.MapFS{}
	for name, contents := range in.Files {
		files[path.Join("src", in.Module, name)] = &fstest.MapFile{Data: []byte(contents)}
	}
	i := interp.New(interp.Options{
		GoPath:               ".",
		SourcecodeFilesystem: files,
		Stdout:               stdout,
		Stderr:               stderr,
	})
	if err := i.Use(stdlib.Symbols); err != nil {
		return nil, err
	}
	return i, nil
}

// Run は、ルートのディレクトリの main の package を実行し、終了コードを返す。
// ディレクトリを渡した EvalPath は、main の panic を Panic のエラーにせずに投げるので、ここで受ける。
func Run(in Input, stdout, stderr io.Writer) (code int) {
	stderr = relativeWriter{stderr, in.Module}
	defer func() {
		if r := recover(); r != nil {
			code = exitCode(interp.Panic{Value: r}, stderr)
		}
	}()
	i, err := newInterpreter(in, stdout, stderr)
	if err == nil {
		_, err = i.EvalPath(in.Module)
	}
	return exitCode(err, stderr)
}

// LoadTests は、in.Package のテストの関数を、名前の順で返す。読み込めないときは、エラーを出して 0 でない終了コードを返す。
func LoadTests(in Input, stdout, stderr io.Writer) ([]testing.InternalTest, int) {
	stderr = relativeWriter{stderr, in.Module}
	i, err := newInterpreter(in, stdout, stderr)
	if err == nil {
		err = i.EvalTest(in.Package)
	}
	if err != nil {
		return nil, exitCode(err, stderr)
	}
	tests := []testing.InternalTest{}
	for name, symbol := range i.Symbols(in.Package)[in.Package] {
		if !strings.HasPrefix(name, "Test") {
			continue
		}
		if f, ok := symbol.Interface().(func(*testing.T)); ok {
			tests = append(tests, testing.InternalTest{Name: name, F: f})
		}
	}
	sort.Slice(tests, func(a, b int) bool { return tests[a].Name < tests[b].Name })
	return tests, 0
}

// Yaegi は、制限した os.Exit を、この文字列の panic にする
var osExit = regexp.MustCompile(`^os\.Exit\((-?\d+)\)$`)

// exitCode は、Yaegi のエラーを終了コードにする。os.Exit は渡した値、panic は 2、コンパイルのエラーは 1 である。
func exitCode(err error, stderr io.Writer) int {
	if err == nil {
		return 0
	}
	if p, ok := errors.AsType[interp.Panic](err); ok {
		if m := osExit.FindStringSubmatch(fmt.Sprint(p.Value)); m != nil {
			code, _ := strconv.Atoi(m[1])
			return code
		}
		fmt.Fprintln(stderr, "panic: "+fmt.Sprint(p.Value))
		return 2
	}
	fmt.Fprintln(stderr, err.Error())
	return 1
}

// relativeWriter は、Yaegi のエラーと panic の行の中のファイルのパスを、ツールのルートからのパスにする。
type relativeWriter struct {
	w      io.Writer
	module string
}

func (r relativeWriter) Write(p []byte) (int, error) {
	if inner, ok := r.w.(relativeWriter); ok {
		return inner.Write(p)
	}
	replaced := strings.ReplaceAll(string(p), path.Join("src", r.module)+"/", "")
	if _, err := io.WriteString(r.w, replaced); err != nil {
		return 0, err
	}
	return len(p), nil
}
