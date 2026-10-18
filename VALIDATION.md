# Validation · 0.1.0-preview.1

## Completed in the Linux build environment

- Release cross-compilation to `x86_64-pc-windows-msvc` succeeded with Rust 1.99.1 and locked Cargo dependencies.
- Executable is a PE32+ x86-64 Windows GUI application. ASLR, high-entropy VA and NX flags are present. This is structural inspection, not a Windows launch test.
- Import inspection: system Windows / UCRT DLLs only; no external `VCRUNTIME140.dll` or `WebView2Loader.dll` import. WebView2 Runtime remains a separate system requirement.
- 9 Rust core tests passed: defaults, configuration type/range validation, round-trip, all 87 physical key mappings, left/right modifiers, Pause, movement bounds, overflow reset, event serialization without typed text.
- 11 animation integration tests passed using a simulated DOM and clock: simultaneous hands, repeats, Pause release, mouse, pause reset, sleep/wake, pretend typing, mixed input, busy speed preservation, 90-second sleep, live configuration, hidden bars and the 30-second minimum.
- Chromium adapter mock passed: initialization, settings button, native-drag API delegation, right-click command, two-key illumination, reset, 117% scaling, hidden bars, settings controls and closing settings. Zero page exceptions. Native calls were mocks.
- Ten baseline SVG, rig and animation files match their recorded Electron preview.5 SHA256 hashes byte for byte. Standalone `Clawd-lab.html` is preserved.
- Source and runtime packages exclude SDKs, Rust targets, LLVM, Cargo caches and node_modules. ZIP integrity and executable hashes are checked during packaging.

## Still requires a real Windows machine

- Launch with an installed WebView2 Runtime; startup settings and tray behavior.
- Global Raw Input while another application has focus, key release, held mouse buttons, keyboard/mouse together, lock/unlock and suspend/resume.
- Dragging to all display edges, multiple monitors and different DPI scales, touchpad right-click and menus while input is paused.
- Live size changes, bars, settings persistence after immediate exit/relaunch, repeated settings open/close and single-instance behavior.
- Real process-tree completeness, memory counters, CPU, long-session stability, WebView2 cache growth.

No Windows runtime, memory or CPU result is claimed for Lite in this release. The Electron observations in COMPARISON.md came from the user's prior sessions and are not a matched benchmark.

## Build notes

Tauri 2.12.4, tauri-build 2.7.3, Wry 0.57.0 and the exact transitive versions are in Cargo.lock. Frontend has no package build step. Release uses thin LTO, size optimization, one codegen unit and stripped symbols. Tauri statically links the VC runtime; UCRT comes from Windows.

Linux cross build used cargo-xwin 0.23.1, LLVM/LLD 18.1.3 and cargo-xwin's documented `clang` backend with windows-msvc-sysroot release 2026-01-16. Archive SHA256:

```text
ba765d78c02fee46564ec1c4a8d711c828260ece21627721e4d95a0161ae0894
```

The default xwin acquisition endpoint was unavailable in this environment. The documented alternative backend was used. SDK/compiler files are not part of either deliverable.

The cross build reports a harmless clang warning that `-L...` is unused while preprocessing resources. There are no Rust compilation errors. The Windows build script is supplied but has not been executed on Windows here.

## Subsequent author feedback · 2026-10-18

After the original candidate was built, the author tried the lightweight app on their own Windows computer and reported that everyday features, sleep, fast typing and startled wake appeared to work normally. CPU usage was often rounded to 0% in Task Manager. These are user observations, not a controlled benchmark or a complete regression matrix.

The v0.1.0 stable archive preserves the originally tested executable byte for byte and retains its internal 0.1.0-preview.1 build version. The historical build-time notes above remain for provenance; the unresolved multi-display and long-session checks are not claimed to have passed.
