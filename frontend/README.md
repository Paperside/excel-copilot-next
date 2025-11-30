# Excel Copilot - Frontend

Next.js frontend for Excel Copilot, featuring a chat interface with AI-powered Excel analysis.

## Features

- **无密码登录**: Simple username-only authentication
- **聊天界面**: Real-time streaming chat with SSE
- **文件管理**: Upload, list, and delete Excel files
- **文件选择**: Select files to include in chat context
- **现代UI**: Built with Tailwind CSS and shadcn/ui

## Tech Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Lucide Icons

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Environment Variables

Create a `.env` file with:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Project Structure

```
app/
├── page.tsx              # Login page
├── chat/
│   └── page.tsx          # Chat interface
├── layout.tsx            # Root layout
└── globals.css           # Global styles

components/
├── ui/                   # shadcn/ui components
│   ├── button.tsx
│   ├── input.tsx
│   ├── toast.tsx
│   └── toaster.tsx
└── file-manager.tsx      # File management component

lib/
├── api-client.ts         # Backend API client
└── utils.ts              # Utility functions

hooks/
└── use-toast.ts          # Toast notifications hook
```

## API Client

The `lib/api-client.ts` provides methods for:

- Authentication (login, getMe)
- File management (upload, list, delete, download)
- Chat streaming (SSE-based)

Example usage:

```typescript
import { apiClient } from '@/lib/api-client'

// Login
await apiClient.login('username')

// Upload file
await apiClient.uploadFile(file)

// Stream chat
for await (const chunk of apiClient.streamChat(message, fileIds)) {
  console.log(chunk)
}
```
