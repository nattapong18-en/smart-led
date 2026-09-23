Redesign the existing Next.js smart light dashboard.

Do not change any ESP32 API logic, command parsing, or existing functionality.

Design direction:

- premium minimal smart-home dashboard
- dark near-black background
- subtle purple accent
- inspired by modern desktop control centers
- avoid excessive borders and nested cards
- avoid generic SaaS dashboard styling
- use whitespace and typography for hierarchy
- responsive desktop/mobile layout

Layout:

- top minimal navigation/status bar
- left 60%: AI light assistant chat
- right 40%: live light status and manual controls
- merge voice controls into the chat composer
- user messages aligned right
- assistant messages aligned left
- large animated bulb visualization
- brightness percentage must be visually prominent
- slider controls bulb glow intensity in real time
- presets use a segmented control
- show ESP32 connection status clearly

Use:

- Tailwind CSS
- shadcn/ui
- lucide-react
- Motion for subtle animations
- Sonner for status notifications

Design tokens:
background #09090b
surface #111116
primary text #f4f4f5
secondary text #92929d
accent #a78bfa
success #6ee7b7
border rgba(255,255,255,0.07)

Avoid:

- excessive gradients
- thick borders
- too many rounded rectangles
- huge header text
- neon cyberpunk styling
- unnecessary decorations
- changing working business logic

First inspect the existing components and preserve all functionality.
Then refactor the UI into reusable components.
