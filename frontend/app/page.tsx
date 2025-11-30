"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim()) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入用户名",
      })
      return
    }

    setLoading(true)

    try {
      await apiClient.login(username)
      toast({
        title: "登录成功",
        description: `欢迎回来, ${username}!`,
      })
      router.push("/chat")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "登录失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Excel Copilot
          </h1>
          <p className="text-gray-600">
            AI驱动的Excel分析助手
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              用户名
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名登录"
              disabled={loading}
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500">
              无需密码,输入用户名即可登录
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>MVP演示版本 - 仅供学习使用</p>
        </div>
      </div>
    </div>
  )
}
