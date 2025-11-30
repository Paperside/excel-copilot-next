"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient, type FileMetadata } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { Send, Paperclip, Loader2, FileText, X } from "lucide-react"
import { FileManager } from "@/components/file-manager"

interface Message {
  role: "user" | "assistant"
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileMetadata[]>([])
  const [showFileManager, setShowFileManager] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      try {
        await apiClient.getMe()
      } catch {
        router.push("/")
      }
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || loading) return

    const userMessage = input.trim()
    const fileIds = selectedFiles.map(f => f.id)

    setInput("")
    setMessages(prev => [...prev, { role: "user", content: userMessage }])
    setLoading(true)

    try {
      let assistantMessage = ""
      setMessages(prev => [...prev, { role: "assistant", content: "" }])

      for await (const chunk of apiClient.streamChat(userMessage, fileIds)) {
        assistantMessage += chunk
        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: assistantMessage,
          }
          return newMessages
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "发送失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (files: FileMetadata[]) => {
    setSelectedFiles(files)
    setShowFileManager(false)
  }

  const removeSelectedFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* File Manager Sidebar */}
      {showFileManager && (
        <div className="w-80 border-r bg-white shadow-lg">
          <FileManager
            selectedFiles={selectedFiles}
            onSelectFiles={handleFileSelect}
            onClose={() => setShowFileManager(false)}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Excel Copilot</h1>
              <p className="text-sm text-gray-600">AI助手为您分析Excel数据</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                apiClient.clearToken()
                router.push("/")
              }}
            >
              退出登录
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <h2 className="text-xl font-semibold mb-2">开始对话</h2>
              <p>上传Excel文件并提问,AI助手将帮助您分析数据</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-900"
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="px-6 py-2 bg-gray-100 border-t">
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 bg-white px-3 py-1 rounded-full text-sm border"
                >
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="max-w-[200px] truncate">{file.originalName}</span>
                  <button
                    onClick={() => removeSelectedFile(file.id)}
                    className="hover:bg-gray-100 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t bg-white px-6 py-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowFileManager(!showFileManager)}
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入消息..."
              disabled={loading}
              className="flex-1"
            />

            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
