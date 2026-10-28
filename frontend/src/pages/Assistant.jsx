import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bot,
  Send,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { assistantApi } from '../api/assistantApi';
import { useAuth } from '../context/AuthContext';

const SUGGESTED_PROMPTS = [
  'Find a scientific calculator under ₹500',
  'Show me campus bicycles in good condition',
  'Find engineering textbooks closing soon',
  'Bid for me up to ₹1000 on a calculator',
];

const Assistant = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadHistory = async () => {
    try {
      setInitialLoading(true);
      const res = await assistantApi.getHistory();
      if (res.success) {
        setMessages(res.messages || []);
      }
    } catch (err) {
      console.error('Error loading assistant history:', err);
    } finally {
      setInitialLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadHistory();
  }, [isAuthenticated]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (customText) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || loading) return;

    setError('');
    setActionSuccess('');
    setInputText('');

    // Append optimistic user message
    const tempUserMsg = {
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await assistantApi.chat(textToSend);
      if (res.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.reply,
            pendingAction: res.pendingAction,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'AI Assistant service unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (actionId) => {
    if (!actionId || confirmingId) return;
    setConfirmingId(actionId);
    setError('');
    setActionSuccess('');

    try {
      const res = await assistantApi.confirmAction(actionId);
      if (res.success) {
        setActionSuccess(res.message);
        // Refresh conversation state to reflect confirmed status
        loadHistory();
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'Failed to confirm action.');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCancelAction = async (actionId) => {
    if (!actionId) return;
    try {
      const res = await assistantApi.cancelAction(actionId);
      if (res.success) {
        setActionSuccess('Proposed bid cancelled.');
        loadHistory();
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'Failed to cancel action.');
    }
  };

  // Helper to parse markdown links: [Title](/auctions/id)
  const renderMessageContent = (content) => {
    if (!content) return null;
    const parts = [];
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      const title = match[1];
      const url = match[2];
      parts.push(
        <Link
          key={match.index}
          to={url}
          className="text-blue-600 hover:text-blue-800 font-bold underline inline-flex items-center gap-0.5"
        >
          <span>{title}</span>
          <ExternalLink className="w-3 h-3 inline ml-0.5" />
        </Link>
      );
      lastIndex = linkRegex.lastIndex;
    }
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }
    return <span className="whitespace-pre-line leading-relaxed">{parts}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col h-[calc(100vh-80px)]">
      {/* Top Header & Safety Info */}
      <div className="border-b border-slate-200/80 pb-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Campus AI Shopping Assistant</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                  Claude Powered
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Search active auctions, compare prices, and prepare verified auto-bid proposals.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            title="Refresh history"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Safety Guarantee Banner */}
        <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-[11px] text-blue-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>
            <strong>Hard Safety Enforced:</strong> The assistant cannot place bids or spend money
            without your explicit click on <strong>Confirm</strong>. All bidding uses public display
            names only.
          </span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess('')}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Chat Messages Scroll Container */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {initialLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-semibold">Connecting to AI assistant...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Hi {user?.name ? user.name.split(' ')[0] : 'there'}! How can I help you today?
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Ask me to find cycles, calculators, textbooks, or prepare an automatic bid ceiling for you.
              </p>
            </div>

            {/* Suggested Starter Prompts */}
            <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto pt-2">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs font-semibold text-slate-700 hover:text-blue-700 transition-all shadow-xs text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isUser = m.role === 'user';
            const action = m.pendingAction;
            return (
              <div
                key={idx}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-xs mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`space-y-3 max-w-[85%] sm:max-w-[75%]`}>
                  <div
                    className={`p-4 rounded-3xl text-xs sm:text-sm ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-500/10'
                        : 'bg-white text-slate-800 rounded-bl-none border border-slate-200/80 shadow-xs'
                    }`}
                  >
                    {isUser ? m.content : renderMessageContent(m.content)}
                  </div>

                  {/* Proposed Bid Confirmation Card (If action proposal present) */}
                  {action && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300/80 shadow-sm space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                          <Zap className="w-4 h-4 text-amber-600" />
                          <span>Proposed Bid Confirmation</span>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Expires in 10m</span>
                        </span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-slate-900 text-sm">
                          {action.itemTitle || action.itemId?.title || 'Campus Auction Item'}
                        </p>
                        <div className="flex items-center justify-between text-slate-600 pt-1">
                          <span>Agreed Maximum Bid:</span>
                          <span className="font-mono font-extrabold text-base text-amber-900">
                            ₹{(action.maxAmountINR || action.maxAmount / 100 || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-amber-900/80 leading-relaxed">
                        The proxy system will bid incrementally for you only when challenged, never exceeding your ceiling.
                      </p>

                      {action.status === 'confirmed' ? (
                        <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>✓ Confirmed & Activated</span>
                        </div>
                      ) : action.status === 'cancelled' ? (
                        <div className="p-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs text-center">
                          Proposal Cancelled
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            disabled={confirmingId === (action.pendingActionId || action._id)}
                            onClick={() => handleConfirmAction(action.pendingActionId || action._id)}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {confirmingId === (action.pendingActionId || action._id)
                                ? 'Activating...'
                                : 'Confirm Bid'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCancelAction(action.pendingActionId || action._id)}
                            className="w-full py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-4 h-4 text-slate-400" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
              <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Assistant is thinking and searching campus listings...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="pt-3 border-t border-slate-200/80 space-y-1.5"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
            placeholder="Ask about items, price ceilings, or say 'bid up to ₹1000 on cycle'..."
            className="flex-1 px-4 py-3 rounded-2xl border border-slate-300 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span>Rate limit: 20 messages / 10 minutes</span>
          <span>Never acts without your manual click on Confirm</span>
        </div>
      </form>
    </div>
  );
};

export default Assistant;

