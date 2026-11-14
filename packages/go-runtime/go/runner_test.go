package main

import (
	"bytes"
	"strings"
	"testing"
)

const greet = "package greet\n\nfunc Hello(n string) string { return \"hello, \" + n }\n"

func mainWith(imports, body string) string {
	return "package main\n\nimport (\n" + imports + "\n)\n\nfunc main() {\n" + body + "\n}\n"
}

func run(t *testing.T, files map[string]string) (int, string) {
	t.Helper()
	var out bytes.Buffer
	code := Run(Input{Files: files, Module: "play", Mode: "run"}, &out, &out)
	return code, out.String()
}

func TestRunRejectsPackagesThatReachTheHost(t *testing.T) {
	for _, pkg := range []string{"syscall/js", "syscall", "unsafe", "os/exec"} {
		t.Run(pkg, func(t *testing.T) {
			code, out := run(t, map[string]string{"main.go": mainWith("\t_ \""+pkg+"\"", "")})
			if code != 1 || !strings.Contains(out, `import "`+pkg+`" error`) {
				t.Fatalf("code = %d, out = %q", code, out)
			}
		})
	}
}

func TestRunResolvesPackagesInDirectories(t *testing.T) {
	code, out := run(t, map[string]string{
		"main.go":              mainWith("\t\"fmt\"\n\t\"play/internal/a\"", "\tfmt.Println(helper(), a.A())"),
		"helper.go":            "package main\n\nfunc helper() string { return \"helper\" }\n",
		"internal/a/a.go":      "package a\n\nimport \"play/internal/b\"\n\nfunc A() string { return \"a+\" + b.B() }\n",
		"internal/b/b.go":      "package b\n\nfunc B() string { return \"b\" }\n",
		"internal/b/b_test.go": "package b\n\nimport \"testing\"\n\nfunc TestB(t *testing.T) {}\n",
	})
	if code != 0 || out != "helper a+b\n" {
		t.Fatalf("code = %d, out = %q", code, out)
	}
}

func TestRunExitCodes(t *testing.T) {
	cases := []struct {
		name string
		body string
		code int
		out  string
	}{
		{"os.Exit の値で、panic の行を出さない", "\tfmt.Println(\"bye\")\n\tos.Exit(3)", 3, "bye\n"},
		{"panic は 2", "\tfmt.Println(\"before\")\n\tpanic(\"boom\")", 2, "before\nmain.go:9:2: panic: play.main(...)\npanic: boom\n"},
		{"型の合わないコードは 1", "\tvar n int = \"x\"\n\tfmt.Println(n, os.Args)", 1, "main.go:9:"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			code, out := run(t, map[string]string{"main.go": mainWith("\t\"fmt\"\n\t\"os\"", c.body)})
			if code != c.code || !strings.HasPrefix(out, c.out) || (c.code == 3 && out != c.out) {
				t.Fatalf("code = %d, out = %q", code, out)
			}
		})
	}
}

func TestLoadTestsOfOnePackage(t *testing.T) {
	var out bytes.Buffer
	files := map[string]string{
		"main.go":        mainWith("\t\"fmt\"\n\t\"play/greet\"", "\tfmt.Println(greet.Hello(\"x\"))"),
		"main_test.go":   "package main\n\nimport \"testing\"\n\nfunc TestMain1(t *testing.T) {}\n",
		"greet/greet.go": greet,
		"greet/greet_test.go": "package greet\n\nimport \"testing\"\n\n" +
			"func TestPass(t *testing.T) {}\n\nfunc TestFail(t *testing.T) { t.Fatal(\"no\") }\n\nfunc helper(t *testing.T) {}\n",
	}
	for pkg, want := range map[string]string{"play": "TestMain1", "play/greet": "TestFail TestPass"} {
		tests, code := LoadTests(Input{Files: files, Module: "play", Mode: "test", Package: pkg}, &out, &out)
		names := []string{}
		for _, test := range tests {
			names = append(names, test.Name)
		}
		if code != 0 || strings.Join(names, " ") != want {
			t.Fatalf("%s: code = %d, tests = %v, out = %q", pkg, code, names, out.String())
		}
	}
	if out.Len() != 0 {
		t.Fatalf("テストを集めるときに main が動いた: %q", out.String())
	}
}

func TestLoadTestsReportsCompileErrors(t *testing.T) {
	var out bytes.Buffer
	files := map[string]string{"greet/greet.go": "package greet\n\nfunc Hello() int { return \"x\" }\n"}
	_, code := LoadTests(Input{Files: files, Module: "play", Mode: "test", Package: "play/greet"}, &out, &out)
	if code != 1 || !strings.HasPrefix(out.String(), "greet/greet.go:3:") {
		t.Fatalf("code = %d, out = %q", code, out.String())
	}
}
