# Native packaging next step

After the recovered web/PWA branch is accepted:

- Windows 11: package the verified `dist/` UI with Tauri 2 + WebView2, with strict navigation allowlisting and native fullscreen/back handling.
- Android: use a native Kotlin shell with AndroidX WebKit or Media3 where direct authorized streams are available; enforce domain allowlists and permit cleartext HTTP only for explicitly approved legacy hosts.
- Keep API/provider configuration out of committed source.
- Build unsigned/debug artifacts in CI unless signing credentials are supplied through repository secrets.

The archived source did not contain a Windows or Android project, so creating native wrappers is a separate implementation rather than restoring existing native code.
