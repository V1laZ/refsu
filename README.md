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

## 📷 Screenshots
<img src="https://github.com/user-attachments/assets/c5c7e83a-1f78-4582-92b6-b31b124b478e" width="250" />
<img src="https://github.com/user-attachments/assets/7bfd8888-142f-42d1-9bc4-b8240fdd2568" width="250" />
<img src="https://github.com/user-attachments/assets/c8d9fc2b-58bc-443f-a103-1325997ddbe9" width="250" />
<img src="https://github.com/user-attachments/assets/68155eb7-6af0-4e28-8f27-1e54cd7ee4d3" width="250" />
<img src="https://github.com/user-attachments/assets/58e4b0ec-0188-4f76-a039-995819fa6140" width="250" />

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
