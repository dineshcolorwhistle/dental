import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  messagingService,
  type ConversationSummary,
  type ChatMessage,
} from '../services';
import toast from 'react-hot-toast';
import {
  MessageCircle,
  Send,
  Check,
  CheckCheck,
  Users,
} from 'lucide-react';

// ─── Helper: Role color ────────────────────────────────────

function roleColor(role: string): string {
  switch (role) {
    case 'OWNER':
      return '#8B5CF6';
    case 'ADMIN':
      return '#3B82F6';
    case 'TECHNICIAN':
      return '#10B981';
    case 'DOCTOR':
      return '#F59E0B';
    default:
      return '#6B7280';
  }
}

function avatarInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

// ─── Props ────────────────────────────────────────────────

interface WorkOrderChatProps {
  workOrderId: string;
}

// ─── Component ─────────────────────────────────────────────

export function WorkOrderChat({ workOrderId }: WorkOrderChatProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  // ─── State ───────────────────────────────────────────────
  const isExpanded = true;
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Typing indicator
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit = useRef(0);

  // Participants panel
  const [showParticipants, setShowParticipants] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // ─── Data Fetching ──────────────────────────────────────

  const fetchConversation = useCallback(async () => {
    if (!workOrderId) return;
    setLoadingConversation(true);
    try {
      const data = await messagingService.getOrCreateWorkOrderConversation(workOrderId);
      setConversation(data);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silently fail
    } finally {
      setLoadingConversation(false);
    }
  }, [workOrderId]);

  const fetchMessages = useCallback(
    async (conversationId: string, cursor?: string) => {
      setLoadingMessages(true);
      try {
        const data = await messagingService.getMessages(conversationId, cursor, 50);
        if (cursor) {
          setMessages((prev) => [...data.messages, ...prev]);
        } else {
          setMessages(data.messages);
        }
        setHasMoreMessages(data.hasMore);
      } catch {
        // silently fail
      } finally {
        setLoadingMessages(false);
      }
    },
    [],
  );

  // ─── Initial Load ───────────────────────────────────────

  useEffect(() => {
    if (!user || user.role === 'SUPER_ADMIN') return;
    fetchConversation();
  }, [user, fetchConversation]);

  // When expanded and conversation exists, load messages
  useEffect(() => {
    if (isExpanded && conversation) {
      fetchMessages(conversation.id);
      // Mark seen
      if (unreadCount > 0) {
        messagingService.markSeen(conversation.id).catch(() => {});
        setUnreadCount(0);
      }
    }
  }, [isExpanded, conversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch on socket reconnect
  useEffect(() => {
    if (isConnected && user && user.role !== 'SUPER_ADMIN') {
      fetchConversation();
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Socket Events ──────────────────────────────────────

  useEffect(() => {
    if (!socket || !conversation) return;

    const handleMessageReceived = (msg: ChatMessage) => {
      if (msg.conversationId === conversation.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Auto-mark seen if expanded
        if (isExpanded) {
          messagingService.markSeen(conversation.id).catch(() => {});
        } else {
          setUnreadCount((prev) => prev + 1);
        }
      }
    };

    const handleMessageSeen = (data: {
      conversationId: string;
      userId: string;
      readAt: string;
    }) => {
      if (data.conversationId === conversation.id) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.senderId === user?.id) {
              const alreadyRead = m.readReceipts.some(
                (r) => r.userId === data.userId,
              );
              if (!alreadyRead) {
                return {
                  ...m,
                  readReceipts: [
                    ...m.readReceipts,
                    { userId: data.userId, readAt: data.readAt },
                  ],
                };
              }
            }
            return m;
          }),
        );
      }
    };

    const handleUserTyping = (data: {
      conversationId: string;
      userId: string;
      firstName: string;
    }) => {
      if (data.conversationId === conversation.id) {
        setTypingUser(data.firstName);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 3000);
      }
    };

    socket.on('message_received', handleMessageReceived);
    socket.on('message_seen', handleMessageSeen);
    socket.on('user_typing', handleUserTyping);

    return () => {
      socket.off('message_received', handleMessageReceived);
      socket.off('message_seen', handleMessageSeen);
      socket.off('user_typing', handleUserTyping);
    };
  }, [socket, conversation, isExpanded, user]);

  // ─── Auto-scroll ───────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Actions ───────────────────────────────────────────

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !conversation) return;
    const content = messageInput.trim();
    setMessageInput('');
    try {
      const msg = await messagingService.sendMessage(conversation.id, content);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const emitTyping = () => {
    if (!socket || !conversation) return;
    const now = Date.now();
    if (now - lastTypingEmit.current > 2000) {
      socket.emit('typing', { conversationId: conversation.id });
      lastTypingEmit.current = now;
    }
  };

  const loadOlderMessages = () => {
    if (!conversation || loadingMessages || !hasMoreMessages || messages.length === 0) return;
    fetchMessages(conversation.id, messages[0].id);
  };

  // ─── Date formatting ──────────────────────────────────

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString(
      i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
      { hour: '2-digit', minute: '2-digit' },
    );

    if (isToday) return timeStr;
    if (isYesterday) return `${t('messaging.yesterday')} ${timeStr}`;
    return date.toLocaleDateString(
      i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
      { day: 'numeric', month: 'short' },
    ) + ` ${timeStr}`;
  };

  // ─── Render ────────────────────────────────────────────

  if (!user || user.role === 'SUPER_ADMIN') return null;

  const participants = conversation?.participants || [];

  return (
    <div className="wo-chat" style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      {/* Header - Always visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          backgroundColor: 'rgba(111, 174, 217, 0.04)',
          borderBottom: '1px solid var(--border)',
          transition: 'background-color 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6FAED9 0%, #A9CFE8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <MessageCircle size={18} color="white" />
          </div>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-heading)',
            }}>
              {t('workOrderChat.title')}
            </h3>
            <p style={{
              margin: 0,
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}>
              {participants.length > 0
                ? t('workOrderChat.participantsCount', { count: participants.length })
                : t('workOrderChat.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '450px' }}>

          {/* Participants Bar */}
          <div style={{
            padding: '0.5rem 1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(111, 174, 217, 0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {participants.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  title={`${p.firstName} ${p.lastName} (${t(`enums.userRole.${p.role}`, { defaultValue: p.role })})`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: roleColor(p.role),
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    border: '2px solid var(--bg-surface)',
                    marginLeft: participants.indexOf(p) > 0 ? '-6px' : '0',
                  }}
                >
                  {avatarInitials(p.firstName, p.lastName)}
                </div>
              ))}
              {participants.length > 5 && (
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                  +{participants.length - 5}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowParticipants(!showParticipants); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
            >
              <Users size={12} />
              {showParticipants ? t('workOrderChat.hideParticipants') : t('workOrderChat.viewParticipants')}
            </button>
          </div>

          {/* Participants Panel (toggleable) */}
          {showParticipants && (
            <div style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--border)',
              maxHeight: '140px',
              overflowY: 'auto',
              backgroundColor: 'rgba(111, 174, 217, 0.02)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {participants.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: roleColor(p.role),
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {avatarInitials(p.firstName, p.lastName)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.firstName} {p.lastName}
                        {p.id === user?.id && (
                          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                            ({t('workOrderChat.you')})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: roleColor(p.role), fontWeight: 600 }}>
                        {t(`enums.userRole.${p.role}`, { defaultValue: p.role })}
                        {p.branchName && (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> • {p.branchName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {/* Load More */}
            {hasMoreMessages && (
              <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  disabled={loadingMessages}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '100px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                  }}
                >
                  {loadingMessages ? t('common.loading') : t('workOrderChat.loadOlder')}
                </button>
              </div>
            )}

            {loadingConversation && messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                {t('common.loading')}
              </div>
            )}

            {!loadingConversation && messages.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: 'var(--text-muted)',
                fontSize: '0.8125rem',
              }}>
                <MessageCircle size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0 }}>{t('workOrderChat.noMessages')}</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMine = msg.senderId === user?.id;
              const senderParticipant = participants.find((p) => p.id === msg.senderId);
              const senderRole = senderParticipant?.role || '';

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: '75%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}>
                    {/* Sender name (for others' messages) */}
                    {!isMine && (
                      <div style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: roleColor(senderRole),
                        paddingLeft: '8px',
                      }}>
                        {msg.sender.firstName} {msg.sender.lastName}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: isMine
                        ? '12px 12px 4px 12px'
                        : '12px 12px 12px 4px',
                      backgroundColor: isMine
                        ? 'var(--accent-primary, #6FAED9)'
                        : 'var(--bg-overlay, rgba(148, 163, 184, 0.08))',
                      color: isMine ? 'white' : 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      lineHeight: '1.5',
                      wordBreak: 'break-word',
                    }}>
                      {msg.content}
                    </div>

                    {/* Meta line */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      justifyContent: isMine ? 'flex-end' : 'flex-start',
                      paddingLeft: isMine ? 0 : '8px',
                      paddingRight: isMine ? '8px' : 0,
                    }}>
                      <span style={{
                        fontSize: '0.625rem',
                        color: 'var(--text-muted)',
                      }}>
                        {formatMessageTime(msg.createdAt)}
                      </span>
                      {isMine && (
                        msg.readReceipts.length > 0
                          ? <CheckCheck size={12} color="var(--accent-primary, #6FAED9)" />
                          : <Check size={12} color="var(--text-muted)" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {typingUser && (
              <div style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                padding: '4px 8px',
              }}>
                {typingUser} {t('messaging.typing')}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--bg-surface)',
          }}>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                emitTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={t('workOrderChat.typeMessage')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '100px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-overlay, rgba(148, 163, 184, 0.04))',
                fontSize: '0.8125rem',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                background: messageInput.trim()
                  ? 'linear-gradient(135deg, #6FAED9 0%, #5A9BC7 100%)'
                  : 'var(--bg-overlay, rgba(148, 163, 184, 0.12))',
                color: messageInput.trim() ? 'white' : 'var(--text-muted)',
                cursor: messageInput.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
