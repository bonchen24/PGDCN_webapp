// Author: Gemini
// OS support: Web/Node
// Description: AI Chatbot Assistant for the Electrical-Electronics Department

import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  Minimize2, 
  Maximize2, 
  Bot, 
  Trash2,
  Loader2,
  Copy,
  Check
} from 'lucide-react';
import { useStore } from '../store';
import { toast } from 'sonner';
import { RequestStatus } from '../types';
import { resolveGeminiModel } from '../utils/geminiSettings';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

export const AIChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `Xin chào! Tôi là **Trợ lý AI phòng Điện - Điện tử**. 

Tôi có thể giúp bạn tra cứu thông tin phiếu yêu cầu nhanh chóng theo **Số phiếu**, **Model sản phẩm**, hoặc **Số tem niêm phong**.

Bạn cần tôi hỗ trợ tìm kiếm gì hôm nay?`,
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
  const { requests, testers, handoverDocs, currentUser } = useStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  const handleClearChat = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa lịch sử trò chuyện này?")) {
      setMessages([
        {
          id: 'welcome',
          role: 'model',
          content: "Tôi đã đặt lại cuộc trò chuyện. Hãy đặt câu hỏi bất kỳ về lịch thử nghiệm của phòng Lab!",
          timestamp: new Date()
        }
      ]);
      setCopiedMessageId(null);
    }
  };

  const handleCopyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast.error('Không thể copy nội dung');
    }
  };

  const generateAppContext = () => {
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const activeNonLogRequests = requests.filter(r => !r.id.includes('-log-'));
    const waitingRequests = activeNonLogRequests.filter(r => !r.scheduledDate);
    const activeRequests = activeNonLogRequests.filter(r => r.scheduledDate && r.status !== RequestStatus.COMPLETED);
    const completedRequests = activeNonLogRequests.filter(r => r.status === RequestStatus.COMPLETED);

    const KtvWorkload = testers.map(t => {
      const assigned = activeNonLogRequests.filter(r => r.testerName === t.name && r.status !== RequestStatus.COMPLETED);
      return `- KTV ${t.name} (${t.shortName}): đang phụ trách ${assigned.length} mẫu chưa hoàn thành.`;
    }).join('\n');

    const sampleDetails = activeNonLogRequests.map(r => {
      const codes = [r.atdEncodeNumber, r.emcEncodeNumber, r.itdEncodeNumber].filter(Boolean).join(' - ') || 'Chưa mã hóa';
      return `- Số phiếu: ${r.requestCode || 'Trống'} | Model: ${r.modelName || 'Trống'} | Tem niêm phong: ${r.sealStamp || 'Trống'} | Mã hóa: ${codes} | Mẫu: ${r.type} | KH: ${r.customerName} | Trạng thái: ${r.status} | Kế hoạch: ${r.scheduledDate || 'Chưa xếp lịch'} | KTV: ${r.testerName || 'Chưa phân công'}`;
    }).join('\n');

    return `
Ngày hiện tại: ${todayStr}
Tài khoản đang đăng nhập: ${currentUser ? `${currentUser.name} (${currentUser.role})` : 'Chưa đăng nhập'}

TỔNG QUAN HỆ THỐNG:
- Tổng số mẫu: ${activeNonLogRequests.length} mẫu.
- Số mẫu trong hàng chờ (chưa xếp lịch): ${waitingRequests.length} mẫu.
- Số mẫu đang tiến hành (đã xếp lịch): ${activeRequests.length} mẫu.
- Số mẫu đã hoàn thành: ${completedRequests.length} mẫu.
- Số biên bản bàn giao: ${handoverDocs.length} biên bản.

DANH SÁCH KỸ THUẬT VIÊN (KTV):
${KtvWorkload}

DANH SÁCH MẪU THỬ:
${sampleDetails}
`;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputMessage).trim();
    if (!messageContent) return;

    if (!textToSend) {
      setInputMessage('');
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const state = useStore.getState();
      const currentUser = state.currentUser;
      const userApiKey = currentUser ? state.userPreferences[currentUser.username]?.geminiApiKey : undefined;

      if (!userApiKey) {
        setMessages(prev => [...prev, {
          id: `bot-${Date.now()}`,
          role: 'model',
          content: 'Vui lòng cài đặt Gemini API Key trong phần "Cài đặt cá nhân" (biểu tượng bánh răng) để sử dụng Trợ lý AI.',
          timestamp: new Date()
        }]);
        setIsLoading(false);
        return;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (userApiKey) {
        headers['X-Gemini-API-Key'] = userApiKey;
      }
      const geminiModel = resolveGeminiModel(state);
      if (geminiModel) {
        headers['x-gemini-model'] = geminiModel;
      }

      const appContext = generateAppContext();
      const historyPayload = messages.slice(1).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: messageContent,
          history: historyPayload,
          appContext: appContext
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let errMsg = errData.error || 'Lỗi phản hồi từ máy chủ AI';
        if (typeof errMsg === 'object') {
          if (errMsg.code === 503 || (errMsg.status && errMsg.status.includes('UNAVAILABLE'))) {
              errMsg = "Hệ thống AI (Gemini) hiện đang bị quá tải (503). Vui lòng thử lại sau vài phút.";
          } else {
              errMsg = errMsg.message || JSON.stringify(errMsg);
          }
        } else if (response.status === 503) {
            errMsg = "Hệ thống AI (Gemini) hiện đang bị quá tải (503). Vui lòng thử lại sau vài phút.";
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'model',
        content: data.text || "Xin lỗi, tôi gặp sự cố khi phân tích câu hỏi.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      toast.error("Lỗi kết nối với Trợ lý AI.");
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          content: `❌ **Đã xảy ra lỗi**: ${error.message || "Vui lòng đảm bảo máy chủ đang hoạt động và API key hợp lệ."}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    handleSendMessage(promptText);
  };

  const renderMessageContent = (content: string) => {
    let html = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-900 text-slate-100 p-2 rounded-lg text-[11px] font-mono my-2 overflow-x-auto whitespace-pre-wrap">$1</pre>');
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    html = html.replace(/### (.*?)\n/g, '<h4 class="font-bold text-slate-800 text-xs mt-3 mb-1">$1</h4>');
    html = html.replace(/## (.*?)\n/g, '<h3 class="font-bold text-slate-800 text-sm mt-3 mb-1">$1</h3>');

    html = html.replace(/^- (.*?)\n/gm, '<li class="ml-4 list-disc text-slate-700 text-xs">$1</li>');

    html = html.replace(/\n/g, '<br/>');

    return <div className="text-xs leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="fixed bottom-24 md:bottom-4 right-4 z-50 flex flex-col items-end">
      {isOpen && (
        <div 
          className={`bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col min-h-0 transition-all overflow-hidden mb-3 md:w-96 w-[calc(100vw-32px)] max-h-[calc(100dvh-7rem)] ${
            isMinimized ? 'h-14' : 'h-[500px]'
          }`}
          id="ai-chatbot-window"
        >
          <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-3 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles size={16} className="text-amber-200 animate-pulse" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-emerald-600" />
              </div>
              <div>
                <h3 className="font-black text-xs uppercase tracking-tight">Trợ lý AI Lab</h3>
                <p className="text-[9px] text-emerald-100 font-medium">Hỗ trợ xếp lịch & kỹ thuật</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-emerald-100">
              <button 
                onClick={() => setIsMinimized(!isMinimized)} 
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title={isMinimized ? "Phóng to" : "Thu nhỏ"}
              >
                {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>
              <button 
                onClick={handleClearChat}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Đặt lại hội thoại"
              >
                <Trash2 size={13} />
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Đóng"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 schedule-scrollarea">
                {messages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role !== 'user' && (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={13} />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-emerald-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                    }`}>
                      {renderMessageContent(msg.content)}
                      <div className={`flex items-center mt-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-between gap-3'}`}>
                        {msg.role === 'model' && (
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-emerald-600 transition-colors"
                            title="Copy nội dung"
                          >
                            {copiedMessageId === msg.id ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} />
                            )}
                            {copiedMessageId === msg.id ? 'Đã copy' : 'Copy'}
                          </button>
                        )}
                        <span className={`text-[8px] ${msg.role === 'user' ? 'text-emerald-200' : 'text-slate-400'}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 animate-bounce">
                      <Bot size={13} />
                    </div>
                    <div className="bg-white rounded-2xl rounded-tl-none border border-slate-100 p-3 shadow-sm">
                      <div className="flex items-center gap-1.5 py-1">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="px-3 py-1.5 bg-white border-t border-slate-100 overflow-x-auto flex gap-1.5 whitespace-nowrap scrollbar-none shrink-0">
                <button 
                  onClick={() => {
                    setInputMessage("Tra cứu thông tin: ");
                    document.getElementById('ai-chat-input')?.focus();
                  }}
                  className="bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors px-2 py-1 rounded-full text-[10px] font-bold"
                >
                  🔍 Tra cứu phiếu (Số phiếu, Model, Tem)
                </button>
              </div>

              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center shrink-0"
              >
                <input
                  id="ai-chat-input"
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Hỏi trợ lý về mẫu thử, tiêu chuẩn, lịch..."
                  className="flex-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                  disabled={isLoading}
                />
                <button 
                  type="submit"
                  className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center shrink-0"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <button 
        onClick={() => {
          setIsOpen(!isOpen);
          setIsMinimized(false);
        }}
        className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 transition-all duration-300 p-3.5 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center group relative border-2 border-white/20"
        id="ai-chatbot-launcher"
        title="Trò chuyện với Trợ lý AI"
      >
        <Sparkles size={20} className="group-hover:rotate-12 transition-transform duration-300 text-amber-200 animate-pulse" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap text-xs font-black uppercase tracking-wider pl-0 group-hover:pl-2">
          Hỏi Trợ lý AI
        </span>
        {!isOpen && (
          <span className="absolute top-0 right-0 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
        )}
      </button>
    </div>
  );
};

// --- End of AIChatBot.tsx ---
