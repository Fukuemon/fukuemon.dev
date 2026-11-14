//go:build js && wasm

// Web Worker の中の WASM の入口。Worker は、globalThis.goRunnerInput に Input の JSON を置いてから起動する。
// 1 つのインスタンスで 1 回だけ実行し、os.Exit で終わる。testing.Main が os.Exit で終わるためである (ADR-0037)。
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"regexp"
	"syscall/js"
	"testing"
)

func main() {
	var in Input
	if err := json.Unmarshal([]byte(js.Global().Get("goRunnerInput").String()), &in); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if in.Mode != "test" {
		os.Exit(Run(in, os.Stdout, os.Stderr))
	}
	testing.Init()
	_ = flag.Set("test.v", "true")
	tests, code := LoadTests(in, os.Stdout, os.Stderr)
	if code != 0 {
		os.Exit(code)
	}
	testing.Main(regexp.MatchString, tests, nil, nil)
}
