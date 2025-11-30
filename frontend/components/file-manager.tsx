"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { apiClient, type FileMetadata } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { Upload, Trash2, X, FileText, Check, Loader2 } from "lucide-react"

interface FileManagerProps {
  selectedFiles: FileMetadata[]
  onSelectFiles: (files: FileMetadata[]) => void
  onClose: () => void
}

export function FileManager({ selectedFiles, onSelectFiles, onClose }: FileManagerProps) {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      const fileList = await apiClient.listFiles()
      setFiles(fileList)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv"
    ]

    if (!validTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "文件类型错误",
        description: "仅支持 Excel (.xlsx, .xls) 和 CSV 文件",
      })
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "文件过大",
        description: "文件大小不能超过 10MB",
      })
      return
    }

    setUploading(true)

    try {
      const uploadedFile = await apiClient.uploadFile(file)
      setFiles(prev => [uploadedFile, ...prev])
      toast({
        title: "上传成功",
        description: `${file.name} 已上传`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "上传失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`确定要删除 "${fileName}" 吗?`)) {
      return
    }

    try {
      await apiClient.deleteFile(fileId)
      setFiles(prev => prev.filter(f => f.id !== fileId))
      toast({
        title: "删除成功",
        description: `${fileName} 已删除`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    }
  }

  const toggleFileSelection = (file: FileMetadata) => {
    const isSelected = selectedFiles.some(f => f.id === file.id)
    if (isSelected) {
      onSelectFiles(selectedFiles.filter(f => f.id !== file.id))
    } else {
      onSelectFiles([...selectedFiles, file])
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">文件管理</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Upload Button */}
      <div className="p-4 border-b">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              上传中...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              上传文件
            </>
          )}
        </Button>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>还没有上传文件</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(file => {
              const isSelected = selectedFiles.some(f => f.id === file.id)
              return (
                <div
                  key={file.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"
                  }`}
                  onClick={() => toggleFileSelection(file)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {isSelected ? (
                        <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.originalName}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatFileSize(file.size)} · {formatDate(file.createdAt)}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteFile(file.id, file.originalName)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50">
        <div className="text-sm text-gray-600">
          已选择 {selectedFiles.length} 个文件
        </div>
      </div>
    </div>
  )
}
