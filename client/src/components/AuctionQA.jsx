import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Flag,
  Eye,
  EyeOff,
  Clock,
  User,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { auctionApi } from '../api/auctionApi';
import { useSocket } from '../context/SocketContext';

const AuctionQA = ({ auctionId, isSeller, isAuthenticated, isAuctionClosed }) => {
  const { socket } = useSocket();

  const [questions, setQuestions] = useState([]);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Ask Question Form
  const [newQuestionText, setNewQuestionText] = useState('');
  const [asking, setAsking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Seller Answer Form State per Question
  const [answerInputs, setAnswerInputs] = useState({});
  const [activeAnswerId, setActiveAnswerId] = useState(null);
  const [answering, setAnswering] = useState(false);

  // Debounce ref for live duplicate check
  const debounceTimer = useRef(null);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await auctionApi.getQuestions(auctionId);
      if (res.success) {
        setQuestions(res.questions || []);
        setUnansweredCount(res.unansweredCount || 0);
      }
    } catch (err) {
      console.error('Error fetching Q&A:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auctionId) {
      fetchQuestions();
    }
  }, [auctionId]);

  // Real-time socket updates for Q&A
  useEffect(() => {
    if (!socket || !auctionId) return;

    const handleQAUpdated = (data) => {
      if (data.itemId === auctionId || data.auctionId === auctionId) {
        fetchQuestions();
      }
    };

    socket.on('qaUpdated', handleQAUpdated);
    return () => {
      socket.off('qaUpdated', handleQAUpdated);
    };
  }, [socket, auctionId]);

  // Live duplicate suggestion as user types
  const handleTextChange = (e) => {
    const text = e.target.value;
    setNewQuestionText(text);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (text.trim().length >= 10) {
      debounceTimer.current = setTimeout(async () => {
        try {
          const res = await auctionApi.checkDuplicateQuestion(auctionId, text);
          if (res.success && res.duplicate) {
            setDuplicateWarning(res.duplicate);
          } else {
            setDuplicateWarning(null);
          }
        } catch {
          // Non-blocking
        }
      }, 400);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newQuestionText.trim().length < 10) {
      setError('Question must be at least 10 characters.');
      return;
    }

    setAsking(true);
    try {
      const res = await auctionApi.askQuestion(auctionId, newQuestionText);
      if (res.success) {
        setSuccess('Your question has been sent to the seller!');
        setNewQuestionText('');
        setDuplicateWarning(null);
        fetchQuestions();
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.isDuplicate) {
        setDuplicateWarning(err.response.data.existingQuestion);
        setError('Someone already asked a similar question.');
      } else {
        setError(err.customMessage || err.message || 'Failed to submit question.');
      }
    } finally {
      setAsking(false);
    }
  };

  const handleAnswerSubmit = async (qId) => {
    const answerText = (answerInputs[qId] || '').trim();
    if (!answerText) return;

    setAnswering(true);
    setError('');
    try {
      const res = await auctionApi.answerQuestion(auctionId, qId, answerText);
      if (res.success) {
        setSuccess('Answer published publicly.');
        setActiveAnswerId(null);
        setAnswerInputs((prev) => ({ ...prev, [qId]: '' }));
        fetchQuestions();
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'Failed to submit answer.');
    } finally {
      setAnswering(false);
    }
  };

  const handleFlagQuestion = async (qId) => {
    setError('');
    try {
      const res = await auctionApi.flagQuestion(auctionId, qId);
      if (res.success) {
        setSuccess(res.message);
        fetchQuestions();
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'Failed to flag question.');
    }
  };

  const handleToggleStatus = async (qId, currentStatus) => {
    const nextStatus = currentStatus === 'visible' ? 'hidden' : 'visible';
    try {
      const res = await auctionApi.updateQuestionStatus(auctionId, qId, nextStatus);
      if (res.success) {
        setSuccess(`Question is now ${nextStatus}.`);
        fetchQuestions();
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'Failed to update visibility.');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-6">
      {/* Q&A Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Community Questions & Answers ({questions.length})
            </h3>
            <p className="text-xs text-slate-500">
              Public inquiries answered by the verified student seller.
            </p>
          </div>
        </div>

        {isSeller && unansweredCount > 0 && (
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold self-start sm:self-auto flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>{unansweredCount} Unanswered Question{unansweredCount > 1 ? 's' : ''}</span>
          </span>
        )}
      </div>

      {/* Notifications / Feedback */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess('')}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ask Question Box (Bidder / Student Only, while auction is active) */}
      {!isSeller && isAuthenticated && !isAuctionClosed && (
        <form onSubmit={handleAskQuestion} className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Ask the Seller a Question</span>
            </label>
            <span
              className={`text-[10px] font-mono font-semibold ${
                newQuestionText.length > 280
                  ? 'text-rose-600'
                  : newQuestionText.length >= 10
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`}
            >
              {newQuestionText.length} / 300
            </span>
          </div>

          <textarea
            rows="2"
            value={newQuestionText}
            onChange={handleTextChange}
            placeholder="e.g. Does it include the charging cable and original receipt?"
            maxLength="300"
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none bg-white"
          />

          {/* Live duplicate suggestion warning card */}
          {duplicateWarning && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300/80 text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Someone already asked a similar question!</span>
              </div>
              <p className="text-amber-800 text-[11px] italic">
                "{duplicateWarning.text}"
              </p>
              {duplicateWarning.answer ? (
                <div className="pt-1 border-t border-amber-200/80 text-[11px] text-emerald-800 font-semibold">
                  ✓ Seller Answer: "{duplicateWarning.answer}"
                </div>
              ) : (
                <span className="text-[10px] text-amber-700 block">
                  Awaiting seller response. Avoid asking the same inquiry.
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-400">
              Max 3 questions per student. Min 10 chars. Keep campus respectful.
            </span>
            <button
              type="submit"
              disabled={asking || newQuestionText.trim().length < 10}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {asking ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Question</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {isAuctionClosed && (
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>This auction has closed. New inquiries are disabled.</span>
        </div>
      )}

      {/* Questions Feed */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
          <MessageSquare className="w-6 h-6 mx-auto text-slate-300" />
          <p className="font-semibold text-slate-600">No questions asked yet.</p>
          <p className="text-[11px]">Have an inquiry about item condition or pickup? Ask above!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div
              key={q._id}
              className={`rounded-2xl border p-4 sm:p-5 transition-all space-y-3 ${
                q.status === 'hidden'
                  ? 'bg-rose-50/50 border-rose-200 opacity-70'
                  : q.answer
                  ? 'bg-slate-50/80 border-slate-200'
                  : 'bg-white border-slate-200/90 shadow-xs'
              }`}
            >
              {/* Question Header & Meta */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{q.asker?.name || 'Student Peer'}</span>
                    </span>
                    <span>•</span>
                    <span>{new Date(q.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>

                    {q.status === 'hidden' && (
                      <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.2 rounded-full text-[10px]">
                        Hidden
                      </span>
                    )}
                    {q.status === 'flagged' && (
                      <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.2 rounded-full text-[10px]">
                        Flagged ({q.flagCount})
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                    {q.text}
                  </p>
                </div>

                {/* Question Actions (Flag / Hide) */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isSeller ? (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(q._id, q.status)}
                      title={q.status === 'visible' ? 'Hide question' : 'Make visible'}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs"
                    >
                      {q.status === 'visible' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    isAuthenticated && (
                      <button
                        type="button"
                        onClick={() => handleFlagQuestion(q._id)}
                        title="Flag inappropriate question"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Seller Answer Section */}
              {q.answer ? (
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Seller's Answer</span>
                    </span>
                    {q.answeredAt && (
                      <span className="text-[10px] text-emerald-700">
                        {new Date(q.answeredAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                    {q.answer}
                  </p>
                </div>
              ) : isSeller ? (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  {activeAnswerId === q._id ? (
                    <div className="space-y-2 animate-fadeIn">
                      <textarea
                        rows="2"
                        placeholder="Type your public response to this inquiry..."
                        value={answerInputs[q._id] || ''}
                        onChange={(e) =>
                          setAnswerInputs({ ...answerInputs, [q._id]: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none bg-white"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveAnswerId(null)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={answering || !(answerInputs[q._id] || '').trim()}
                          onClick={() => handleAnswerSubmit(q._id)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
                        >
                          {answering ? 'Submitting...' : 'Publish Answer'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveAnswerId(q._id)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-all flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Reply to Asker</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-amber-700 italic flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>Awaiting seller response</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuctionQA;

