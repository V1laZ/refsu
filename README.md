# Refsu
A modern, cross-platform IRC client specifically designed for osu! referees and tournament organizers.

## 🚀 Installing
> [!IMPORTANT]
> Please **disable battery optimizations** on Android for this app, otherwise you'll keep disconnecting from Bancho!

1. Visit the [Releases](https://github.com/V1laZ/refsu/releases) page
2. Download the appropriate version for your operating system
3. Install and run the application

## 🔧 Features
- Keep track of current lobby state
- One-click UI for frequently used commands
- Create mappools and select maps in lobby with ease 

## 🖥️ Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) package manager
- [Rust](https://rustup.rs/) (latest stable)

#### Install dependencies
```bash
pnpm install
```

#### Start Development Server
```bash
pnpm tauri dev
```

#### Build for Production
```bash
pnpm tauri build
```

#### Mobile Development (Android)
```bash
# Add Android target
pnpm tauri android init

# Run on physical Android device
pnpm tauri android dev

# Run on Android emulator
pnpm tauri android dev --open

# Build Android APK
pnpm tauri android build
```
---

Made with ❤️ for the osu! community
