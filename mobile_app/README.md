# VPP Mobile App

Cross-platform mobile application for the VPP Aggregation Platform built with Flutter.

## Features

- Real-time telemetry monitoring
- Node status overview
- Dispatch control interface
- Push notifications for critical events
- Offline data caching
- Dark mode support

## Getting Started

### Prerequisites

- Flutter SDK 3.0+
- Dart 3.0+
- Android Studio / Xcode (for platform-specific builds)

### Installation

```bash
# Install dependencies
flutter pub get

# Run on connected device/emulator
flutter run

# Build for production
flutter build apk  # Android
flutter build ios  # iOS
```

### Configuration

Create a `.env` file in the project root:

```env
API_URL=https://your-api-url.com
WS_URL=wss://your-ws-url.com
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-mobile-client-id
```

## Architecture

```
lib/
├── main.dart
├── models/         # Data models
├── providers/      # State management (Riverpod)
├── screens/        # UI screens
├── services/       # API & WebSocket services
├── widgets/        # Reusable components
└── utils/          # Helper functions
```

## Development

```bash
# Run with hot reload
flutter run

# Run tests
flutter test

# Analyze code
flutter analyze

# Format code
flutter format lib
```

## Supported Platforms

- Android 6.0+ (API 23+)
- iOS 12+

## TODO

- [ ] Implement Auth0 authentication
- [ ] WebSocket real-time updates
- [ ] Charts integration (fl_chart)
- [ ] Push notifications
- [ ] Offline mode
- [ ] Unit & widget tests
