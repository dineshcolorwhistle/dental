import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  messagingService,
  type Contact,
  type ConversationSummary,
  type ChatMessage,
  type GroupMember,
} from '../services';
import toast from 'react-hot-toast';
import {
  MessageCircle,
  X,
  Search,
  Send,
  ArrowLeft,
  Check,
  CheckCheck,
  Users,
  UserPlus,
  Trash2,
  MoreVertical,
  Edit3,
  LogOut,
  Plus,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────

type ChatView = 'list' | 'chat' | 'create-group' | 'group-info';

// ─── Helper: Role color ────────────────────────────────────

function roleColor(role: string): string {
  switch (role) {
    case 'OWNER':
      return '#8B5CF6';
    case 'ADMIN':
      return '#3B82F6';
    case 'TECHNICIAN':
      return '#10B981';
    default:
      return '#6B7280';
  }
}

function avatarInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

// ─── Component ─────────────────────────────────────────────

export function ChatWidget() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  // ─── State ───────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<ChatView>('list');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // Typing
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map()); // conversationId -> firstName
  const typingTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingEmit = useRef(0);

  // Group creation
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Group info
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [showAddMembers, setShowAddMembers] = useState(false);

  // Menu
  const [showMenu, setShowMenu] = useState(false);
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Clear chat confirm modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // Remove member confirm modal
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  // Leave group confirm modal
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // ─── Data Fetching ──────────────────────────────────────

  const fetchContacts = useCallback(async () => {
    try {
      const data = await messagingService.getContacts();
      setContacts(data);
    } catch {
      // silently fail
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await messagingService.getConversations();
      setConversations(data);
    } catch {
      // silently fail
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await messagingService.getUnreadCount();
      setTotalUnread(data.count);
    } catch {
      // silently fail
    }
  }, []);

  const fetchMessages = useCallback(
    async (conversationId: string, cursor?: string) => {
      setLoadingMessages(true);
      try {
        const data = await messagingService.getMessages(
          conversationId,
          cursor,
          50,
        );
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
    fetchContacts();
    fetchConversations();
    fetchUnreadCount();
  }, [user, fetchContacts, fetchConversations, fetchUnreadCount]);

  // Refetch on socket reconnect
  useEffect(() => {
    if (isConnected && user && user.role !== 'SUPER_ADMIN') {
      fetchConversations();
      fetchUnreadCount();
    }
  }, [isConnected, user, fetchConversations, fetchUnreadCount]);

  // ─── Socket Events ──────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (msg: ChatMessage) => {
      // Ignore messages belonging to a dedicated Work Order chat
      if (msg.conversation?.workOrderId) {
        return;
      }

      // If we're in the active conversation, append the message
      if (activeConversation && msg.conversationId === activeConversation.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Auto-mark seen
        messagingService.markSeen(msg.conversationId).catch(() => {});
      } else {
        setTotalUnread((prev) => prev + 1);
      }
      // Update conversation list
      fetchConversations();
    };

    const handleMessageSeen = (data: {
      conversationId: string;
      userId: string;
      readAt: string;
    }) => {
      if (activeConversation && data.conversationId === activeConversation.id) {
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
      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.conversationId, data.firstName);
        return newMap;
      });
      // Clear after 3 seconds
      const existingTimeout = typingTimeoutRef.current.get(
        data.conversationId,
      );
      if (existingTimeout) clearTimeout(existingTimeout);
      typingTimeoutRef.current.set(
        data.conversationId,
        setTimeout(() => {
          setTypingUsers((prev) => {
            const newMap = new Map(prev);
            newMap.delete(data.conversationId);
            return newMap;
          });
        }, 3000),
      );
    };

    const handleConversationUpdated = () => {
      fetchConversations();
      fetchUnreadCount();
    };

    const handleGroupMemberRemoved = (data: { conversationId: string }) => {
      if (activeConversation && data.conversationId === activeConversation.id) {
        setView('list');
        setActiveConversation(null);
      }
      fetchConversations();
    };

    socket.on('message_received', handleMessageReceived);
    socket.on('message_seen', handleMessageSeen);
    socket.on('user_typing', handleUserTyping);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('group_member_removed', handleGroupMemberRemoved);

    return () => {
      socket.off('message_received', handleMessageReceived);
      socket.off('message_seen', handleMessageSeen);
      socket.off('user_typing', handleUserTyping);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('group_member_removed', handleGroupMemberRemoved);
    };
  }, [socket, activeConversation, user, fetchConversations, fetchUnreadCount]);

  // ─── Auto-scroll ───────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Actions ───────────────────────────────────────────

  const openConversation = async (conv: ConversationSummary) => {
    setActiveConversation(conv);
    setView('chat');
    setMessageInput('');
    setShowMenu(false);
    await fetchMessages(conv.id);
    // Mark seen
    if (conv.unreadCount > 0) {
      await messagingService.markSeen(conv.id).catch(() => {});
      setTotalUnread((prev) => Math.max(0, prev - conv.unreadCount));
      fetchConversations();
    }
  };

  const startConversationWith = async (contact: Contact) => {
    try {
      const conv = await messagingService.createConversation(contact.id);
      const summary: ConversationSummary = {
        id: conv.id,
        name: conv.name,
        isGroup: conv.isGroup,
        createdById: null,
        participants: conv.participants,
        lastMessage: null,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      };
      setActiveConversation(summary);
      setView('chat');
      setMessageInput('');
      setShowMenu(false);
      await fetchMessages(conv.id);
      fetchConversations();
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeConversation) return;
    const content = messageInput.trim();
    setMessageInput('');
    try {
      const msg = await messagingService.sendMessage(
        activeConversation.id,
        content,
      );
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      fetchConversations();
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const emitTyping = () => {
    if (!socket || !activeConversation) return;
    const now = Date.now();
    if (now - lastTypingEmit.current > 2000) {
      socket.emit('typing', { conversationId: activeConversation.id });
      lastTypingEmit.current = now;
    }
  };

  const handleClearChat = async () => {
    if (!activeConversation) return;
    try {
      await messagingService.clearConversation(activeConversation.id);
      setMessages([]);
      setShowClearConfirm(false);
      setShowMenu(false);
      toast.success(t('messaging.chatCleared'));
      fetchConversations();
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  // ─── Group Actions ──────────────────────────────────────

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMemberIds.size < 2) {
      toast.error(t('messaging.minGroupMembers'));
      return;
    }
    try {
      const conv = await messagingService.createGroup(
        groupName.trim(),
        Array.from(selectedMemberIds),
      );
      toast.success(t('messaging.groupCreated'));
      setGroupName('');
      setSelectedMemberIds(new Set());
      const summary: ConversationSummary = {
        id: conv.id,
        name: conv.name,
        isGroup: conv.isGroup,
        createdById: user?.id || null,
        participants: conv.participants,
        lastMessage: null,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      };
      setActiveConversation(summary);
      setView('chat');
      await fetchMessages(conv.id);
      fetchConversations();
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const openGroupInfo = async () => {
    if (!activeConversation) return;
    try {
      const members = await messagingService.getGroupMembers(
        activeConversation.id,
      );
      setGroupMembers(members);
      setView('group-info');
      setShowMenu(false);
      setShowAddMembers(false);
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const handleAddMembers = async () => {
    if (!activeConversation || selectedMemberIds.size === 0) return;
    try {
      await messagingService.addGroupMembers(
        activeConversation.id,
        Array.from(selectedMemberIds),
      );
      toast.success(t('messaging.memberAdded'));
      setSelectedMemberIds(new Set());
      setShowAddMembers(false);
      const members = await messagingService.getGroupMembers(
        activeConversation.id,
      );
      setGroupMembers(members);
      fetchConversations();
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const handleRemoveMember = async () => {
    if (!activeConversation || !memberToRemove) return;
    try {
      await messagingService.removeGroupMember(
        activeConversation.id,
        memberToRemove.id,
      );
      toast.success(t('messaging.memberRemoved'));
      setMemberToRemove(null);
      const members = await messagingService.getGroupMembers(
        activeConversation.id,
      );
      setGroupMembers(members);
      fetchConversations();
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeConversation || !user) return;
    try {
      await messagingService.removeGroupMember(
        activeConversation.id,
        user.id,
      );
      setShowLeaveConfirm(false);
      setView('list');
      setActiveConversation(null);
      fetchConversations();
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const handleRenameGroup = async () => {
    if (!activeConversation || !renameValue.trim()) return;
    try {
      await messagingService.renameGroup(
        activeConversation.id,
        renameValue.trim(),
      );
      toast.success(t('messaging.groupRenamed'));
      setShowRenameInput(false);
      setShowMenu(false);
      setActiveConversation((prev) =>
        prev ? { ...prev, name: renameValue.trim() } : prev,
      );
      fetchConversations();
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  // ─── Helpers ───────────────────────────────────────────

  const getConversationDisplayName = (conv: ConversationSummary): string => {
    if (conv.isGroup && conv.name) return conv.name;
    const other = conv.participants.find((p) => p.id !== user?.id);
    return other ? `${other.firstName} ${other.lastName}` : t('messaging.title');
  };

  const getConversationSubtitle = (conv: ConversationSummary): string => {
    if (conv.isGroup) {
      return `${conv.participants.length} ${t('messaging.members').toLowerCase()}`;
    }
    const other = conv.participants.find((p) => p.id !== user?.id);
    if (!other) return '';
    const roleName = t(`enums.userRole.${other.role}`);
    return other.branchName ? `${roleName} • ${other.branchName}` : roleName;
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const locale = i18n.language?.startsWith('es') ? 'es-MX' : 'en-US';

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return t('messaging.yesterday');
    }

    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
    });
  };

  const formatMessageDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const locale = i18n.language?.startsWith('es') ? 'es-MX' : 'en-US';

    if (date.toDateString() === now.toDateString()) {
      return t('messaging.today');
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return t('messaging.yesterday');
    }

    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const shouldShowDateSeparator = (
    messages: ChatMessage[],
    index: number,
  ): boolean => {
    if (index === 0) return true;
    const curr = new Date(messages[index].createdAt).toDateString();
    const prev = new Date(messages[index - 1].createdAt).toDateString();
    return curr !== prev;
  };

  // ─── Filtered data ──────────────────────────────────────

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      (c.branch?.name || '').toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q)
    );
  });

  // Contacts not in any conversation yet
  const contactsWithoutConversation = filteredContacts.filter((c) => {
    return !conversations.some(
      (conv) =>
        !conv.isGroup &&
        conv.participants.some((p) => p.id === c.id),
    );
  });

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const displayName = getConversationDisplayName(conv).toLowerCase();
    return displayName.includes(q);
  });

  // Members available for adding to a group (not already in it)
  const availableMembers = contacts.filter((c) => {
    if (view === 'create-group') {
      return true;
    }
    // In group-info, filter out existing members
    return !groupMembers.some((m) => m.id === c.id);
  });

  // ─── Don't render for non-eligible roles ────────────────

  if (
    !user ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'DELIVERY'
  ) {
    return null;
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <>
      {/* Floating Action Button */}
      <button
        id="chat-fab"
        className="chat-fab"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            fetchConversations();
            fetchUnreadCount();
          }
        }}
        aria-label={t('messaging.title')}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {!isOpen && totalUnread > 0 && (
          <span className="chat-fab__badge">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Chat Popup */}
      {isOpen && (
        <div className={`chat-popup ${view === 'chat' || view === 'group-info' ? 'chat-popup--expanded' : ''}`} ref={popupRef}>
          {/* ─── LIST VIEW ─────────────────────────────── */}
          {view === 'list' && (
            <>
              <div className="chat-popup__header">
                <div>
                  <h3 className="chat-popup__title">{t('messaging.title')}</h3>
                  <span className="chat-popup__subtitle">
                    {t('messaging.autoDeleteNotice')}
                  </span>
                </div>
                <button
                  className="chat-popup__close"
                  onClick={() => setIsOpen(false)}
                  aria-label={t('common.close')}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="chat-search">
                <Search size={16} className="chat-search__icon" />
                <input
                  type="text"
                  className="chat-search__input"
                  placeholder={t('messaging.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* New Group Button */}
              <button
                className="chat-new-group-btn"
                onClick={() => {
                  setView('create-group');
                  setGroupName('');
                  setSelectedMemberIds(new Set());
                  setSearchQuery('');
                }}
              >
                <div className="chat-new-group-btn__icon">
                  <Users size={18} />
                </div>
                <span>{t('messaging.newGroup')}</span>
                <Plus size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              </button>

              <div className="chat-contacts-list">
                {/* Recent Chats */}
                {filteredConversations.length > 0 && (
                  <>
                    <div className="chat-section-title">
                      {t('messaging.recentChats')}
                    </div>
                    {filteredConversations.map((conv) => {
                      const displayName = getConversationDisplayName(conv);
                      const subtitle = getConversationSubtitle(conv);
                      const typingName = typingUsers.get(conv.id);
                      const otherUser = conv.participants.find((p) => p.id !== user?.id);

                      return (
                        <button
                          key={conv.id}
                          className="chat-contact-item"
                          onClick={() => openConversation(conv)}
                        >
                          <div
                            className="chat-contact-item__avatar"
                            style={{
                              background: conv.isGroup
                                ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                                : roleColor(otherUser?.role || ''),
                            }}
                          >
                            {conv.isGroup ? (
                              <Users size={16} />
                            ) : (
                              avatarInitials(
                                otherUser?.firstName || '',
                                otherUser?.lastName || '',
                              )
                            )}
                          </div>
                          <div className="chat-contact-item__info">
                            <div className="chat-contact-item__name">
                              {displayName}
                            </div>
                            <div className="chat-contact-item__preview">
                              {typingName ? (
                                <span className="chat-typing-text">
                                  {typingName} {t('messaging.typing')}
                                </span>
                              ) : conv.lastMessage ? (
                                <span>
                                  {conv.lastMessage.senderId === user?.id
                                    ? `${t('messaging.you')}: `
                                    : conv.isGroup
                                      ? `${conv.lastMessage.senderName.split(' ')[0]}: `
                                      : ''}
                                  {conv.lastMessage.content.length > 35
                                    ? conv.lastMessage.content.slice(0, 35) + '...'
                                    : conv.lastMessage.content}
                                </span>
                              ) : (
                                <span style={{ opacity: 0.5 }}>{subtitle}</span>
                              )}
                            </div>
                          </div>
                          <div className="chat-contact-item__meta">
                            {conv.lastMessage && (
                              <span className="chat-contact-item__time">
                                {formatTime(conv.lastMessage.createdAt)}
                              </span>
                            )}
                            {conv.unreadCount > 0 && (
                              <span className="chat-contact-item__unread">
                                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Team Members */}
                {contactsWithoutConversation.length > 0 && (
                  <>
                    <div className="chat-section-title">
                      {t('messaging.teamMembers')}
                    </div>
                    {contactsWithoutConversation.map((contact) => (
                      <button
                        key={contact.id}
                        className="chat-contact-item"
                        onClick={() => startConversationWith(contact)}
                      >
                        <div
                          className="chat-contact-item__avatar"
                          style={{ background: roleColor(contact.role) }}
                        >
                          {avatarInitials(contact.firstName, contact.lastName)}
                        </div>
                        <div className="chat-contact-item__info">
                          <div className="chat-contact-item__name">
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="chat-contact-item__preview">
                            <span className="chat-contact-item__role-badge">
                              {t(`enums.userRole.${contact.role}`)}
                            </span>
                            {contact.branch && (
                              <span style={{ opacity: 0.6, marginLeft: 4, fontSize: '0.72rem' }}>
                                • {contact.branch.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {filteredConversations.length === 0 &&
                  contactsWithoutConversation.length === 0 && (
                    <div className="chat-empty">
                      <MessageCircle size={28} style={{ opacity: 0.2 }} />
                      <span>{t('messaging.noContacts')}</span>
                    </div>
                  )}
              </div>
            </>
          )}

          {/* ─── CHAT VIEW ──────────────────────────────── */}
          {view === 'chat' && activeConversation && (
            <>
              <div className="chat-popup__header chat-popup__header--chat">
                <button
                  className="chat-back-btn"
                  onClick={() => {
                    setView('list');
                    setActiveConversation(null);
                    setShowMenu(false);
                    fetchConversations();
                    fetchUnreadCount();
                  }}
                  aria-label={t('common.back')}
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="chat-popup__header-info" onClick={() => {
                  if (activeConversation.isGroup) openGroupInfo();
                }}>
                  <h3 className="chat-popup__title" style={{ cursor: activeConversation.isGroup ? 'pointer' : 'default' }}>
                    {getConversationDisplayName(activeConversation)}
                  </h3>
                  <span className="chat-popup__subtitle">
                    {getConversationSubtitle(activeConversation)}
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    className="chat-menu-btn"
                    onClick={() => setShowMenu(!showMenu)}
                    aria-label="Menu"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {showMenu && (
                    <div className="chat-dropdown-menu">
                      {activeConversation.isGroup && (
                        <>
                          <button
                            className="chat-dropdown-menu__item"
                            onClick={openGroupInfo}
                          >
                            <Users size={14} />
                            <span>{t('messaging.groupInfo')}</span>
                          </button>
                          {(activeConversation.createdById === user?.id ||
                            user?.role === 'OWNER') && (
                            <button
                              className="chat-dropdown-menu__item"
                              onClick={() => {
                                setRenameValue(activeConversation.name || '');
                                setShowRenameInput(true);
                                setShowMenu(false);
                              }}
                            >
                              <Edit3 size={14} />
                              <span>{t('messaging.renameGroup')}</span>
                            </button>
                          )}
                          <button
                            className="chat-dropdown-menu__item chat-dropdown-menu__item--danger"
                            onClick={() => {
                              setShowLeaveConfirm(true);
                              setShowMenu(false);
                            }}
                          >
                            <LogOut size={14} />
                            <span>{t('messaging.leaveGroup')}</span>
                          </button>
                        </>
                      )}
                      <button
                        className="chat-dropdown-menu__item chat-dropdown-menu__item--danger"
                        onClick={() => {
                          setShowClearConfirm(true);
                          setShowMenu(false);
                        }}
                      >
                        <Trash2 size={14} />
                        <span>{t('messaging.clearChat')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Rename input */}
              {showRenameInput && (
                <div className="chat-rename-bar">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder={t('messaging.groupNamePlaceholder')}
                    className="chat-rename-bar__input"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameGroup();
                      if (e.key === 'Escape') setShowRenameInput(false);
                    }}
                  />
                  <button
                    className="chat-rename-bar__btn"
                    onClick={handleRenameGroup}
                  >
                    <Check size={16} />
                  </button>
                </div>
              )}

              {/* Messages */}
              <div className="chat-messages" ref={messagesContainerRef}>
                <div className="chat-legend-bar">
                  <span>✓ {t('messaging.sent')} • ✓✓ {t('messaging.seen')}</span>
                </div>
                {hasMoreMessages && (
                  <button
                    className="chat-load-more"
                    onClick={() => {
                      if (messages.length > 0) {
                        fetchMessages(activeConversation.id, messages[0].id);
                      }
                    }}
                    disabled={loadingMessages}
                  >
                    {loadingMessages ? '...' : t('pagination.loadMore')}
                  </button>
                )}

                {messages.length === 0 && !loadingMessages && (
                  <div className="chat-empty" style={{ marginTop: '2rem' }}>
                    <MessageCircle size={28} style={{ opacity: 0.2 }} />
                    <span>{t('messaging.noMessages')}</span>
                  </div>
                )}

                {messages.map((msg, idx) => {
                  const isMine = msg.senderId === user?.id;
                  const showDate = shouldShowDateSeparator(messages, idx);
                  const hasReceipts = msg.readReceipts.length > 0;
                  const participantCount =
                    activeConversation.participants.length;

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="chat-date-separator">
                          <span>{formatMessageDate(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className={`chat-message-row ${isMine ? 'chat-message-row--sent' : 'chat-message-row--received'}`}>
                        <div
                          className={`chat-bubble ${isMine ? 'chat-bubble--sent' : 'chat-bubble--received'}`}
                        >
                          {/* Show sender name in group chats for received messages */}
                          {!isMine && activeConversation.isGroup && (
                            <div
                              className="chat-bubble__sender"
                              style={{ color: roleColor(
                                activeConversation.participants.find(
                                  (p) => p.id === msg.senderId,
                                )?.role || '',
                              )}}
                            >
                              {msg.sender.firstName}
                            </div>
                          )}
                          <div className="chat-bubble__content">{msg.content}</div>
                          <div className="chat-bubble__footer">
                            <span className="chat-bubble__time">
                              {new Date(msg.createdAt).toLocaleTimeString(
                                i18n.language?.startsWith('es')
                                  ? 'es-MX'
                                  : 'en-US',
                                { hour: '2-digit', minute: '2-digit' },
                              )}
                            </span>
                            {isMine && (
                              <span
                                className={`chat-bubble__receipt ${hasReceipts ? 'chat-bubble__receipt--seen' : ''}`}
                                title={
                                  hasReceipts
                                    ? activeConversation.isGroup
                                      ? `${t('messaging.seenBy', {
                                          count: msg.readReceipts.length,
                                          total: participantCount - 1,
                                        })}`
                                      : `${t('messaging.seen')} ${formatTime(
                                          msg.readReceipts[0]?.readAt,
                                        )}`
                                    : t('messaging.sent')
                                }
                              >
                                {hasReceipts ? (
                                  <CheckCheck size={14} />
                                ) : (
                                  <Check size={14} />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {typingUsers.has(activeConversation.id) && (
                  <div className="chat-message-row chat-message-row--received">
                    <div className="chat-bubble chat-bubble--received">
                      <div className="chat-typing-indicator">
                        <span className="chat-typing-indicator__name">
                          {typingUsers.get(activeConversation.id)}
                        </span>
                        <span className="chat-typing-indicator__dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="chat-input-area">
                <input
                  type="text"
                  className="chat-input-area__input"
                  placeholder={t('messaging.typeMessage')}
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
                />
                <button
                  className="chat-input-area__send"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  aria-label={t('messaging.send')}
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          )}

          {/* ─── CREATE GROUP VIEW ──────────────────────── */}
          {view === 'create-group' && (
            <>
              <div className="chat-popup__header">
                <button
                  className="chat-back-btn"
                  onClick={() => {
                    setView('list');
                    setSearchQuery('');
                  }}
                  aria-label={t('common.back')}
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h3 className="chat-popup__title">
                    {t('messaging.newGroup')}
                  </h3>
                </div>
                <div style={{ width: 32 }} />
              </div>

              <div className="chat-group-form">
                <input
                  type="text"
                  className="chat-group-form__name-input"
                  placeholder={t('messaging.groupNamePlaceholder')}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  autoFocus
                />

                {/* Selected Members Chips */}
                {selectedMemberIds.size > 0 && (
                  <div className="chat-member-chips">
                    {Array.from(selectedMemberIds).map((id) => {
                      const c = contacts.find((c) => c.id === id);
                      if (!c) return null;
                      return (
                        <span key={id} className="chat-member-chip">
                          {c.firstName} {c.lastName}
                          <button
                            onClick={() => {
                              setSelectedMemberIds((prev) => {
                                const next = new Set(prev);
                                next.delete(id);
                                return next;
                              });
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="chat-section-title">
                  {t('messaging.selectMembers')} ({selectedMemberIds.size})
                </div>

                <div className="chat-contacts-list" style={{ maxHeight: '240px' }}>
                  {availableMembers.map((contact) => (
                    <label key={contact.id} className="chat-contact-item chat-contact-item--selectable">
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.has(contact.id)}
                        onChange={() => {
                          setSelectedMemberIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(contact.id)) {
                              next.delete(contact.id);
                            } else {
                              next.add(contact.id);
                            }
                            return next;
                          });
                        }}
                        className="chat-checkbox"
                      />
                      <div
                        className="chat-contact-item__avatar"
                        style={{ background: roleColor(contact.role) }}
                      >
                        {avatarInitials(contact.firstName, contact.lastName)}
                      </div>
                      <div className="chat-contact-item__info">
                        <div className="chat-contact-item__name">
                          {contact.firstName} {contact.lastName}
                        </div>
                        <div className="chat-contact-item__preview">
                          <span className="chat-contact-item__role-badge">
                            {t(`enums.userRole.${contact.role}`)}
                          </span>
                          {contact.branch && (
                            <span style={{ opacity: 0.6, marginLeft: 4, fontSize: '0.72rem' }}>
                              • {contact.branch.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  className="chat-group-form__create-btn"
                  onClick={handleCreateGroup}
                  disabled={!groupName.trim() || selectedMemberIds.size < 2}
                >
                  {t('messaging.createGroup')}
                </button>
              </div>
            </>
          )}

          {/* ─── GROUP INFO VIEW ───────────────────────── */}
          {view === 'group-info' && activeConversation && (
            <>
              <div className="chat-popup__header">
                <button
                  className="chat-back-btn"
                  onClick={() => setView('chat')}
                  aria-label={t('common.back')}
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h3 className="chat-popup__title">
                    {t('messaging.groupInfo')}
                  </h3>
                  <span className="chat-popup__subtitle">
                    {activeConversation.name}
                  </span>
                </div>
                <div style={{ width: 32 }} />
              </div>

              <div className="chat-contacts-list">
                <div className="chat-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    {t('messaging.memberCount', {
                      count: groupMembers.length,
                    })}
                  </span>
                  {(activeConversation.createdById === user?.id ||
                    user?.role === 'OWNER') && (
                    <button
                      className="chat-add-member-btn"
                      onClick={() => {
                        setShowAddMembers(!showAddMembers);
                        setSelectedMemberIds(new Set());
                      }}
                    >
                      <UserPlus size={14} />
                      <span>{t('messaging.addMembers')}</span>
                    </button>
                  )}
                </div>

                {/* Add Members Inline */}
                {showAddMembers && (
                  <div className="chat-add-members-section">
                    {availableMembers.map((contact) => (
                      <label
                        key={contact.id}
                        className="chat-contact-item chat-contact-item--selectable"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.has(contact.id)}
                          onChange={() => {
                            setSelectedMemberIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(contact.id)) {
                                next.delete(contact.id);
                              } else {
                                next.add(contact.id);
                              }
                              return next;
                            });
                          }}
                          className="chat-checkbox"
                        />
                        <div
                          className="chat-contact-item__avatar"
                          style={{ background: roleColor(contact.role) }}
                        >
                          {avatarInitials(
                            contact.firstName,
                            contact.lastName,
                          )}
                        </div>
                        <div className="chat-contact-item__info">
                          <div className="chat-contact-item__name">
                            {contact.firstName} {contact.lastName}
                          </div>
                        </div>
                      </label>
                    ))}
                    {selectedMemberIds.size > 0 && (
                      <button
                        className="chat-group-form__create-btn"
                        onClick={handleAddMembers}
                        style={{ margin: '0.5rem 1rem' }}
                      >
                        {t('messaging.addMembers')} ({selectedMemberIds.size})
                      </button>
                    )}
                  </div>
                )}

                {/* Member List */}
                {groupMembers.map((member) => (
                  <div key={member.id} className="chat-contact-item">
                    <div
                      className="chat-contact-item__avatar"
                      style={{ background: roleColor(member.role) }}
                    >
                      {avatarInitials(member.firstName, member.lastName)}
                    </div>
                    <div className="chat-contact-item__info">
                      <div className="chat-contact-item__name">
                        {member.firstName} {member.lastName}
                        {member.isCreator && (
                          <span className="chat-creator-badge">
                            {t('messaging.creator')}
                          </span>
                        )}
                      </div>
                      <div className="chat-contact-item__preview">
                        <span className="chat-contact-item__role-badge">
                          {t(`enums.userRole.${member.role}`)}
                        </span>
                        {member.branchName && (
                          <span style={{ opacity: 0.6, marginLeft: 4, fontSize: '0.72rem' }}>
                            • {member.branchName}
                          </span>
                        )}
                      </div>
                    </div>
                    {member.id !== user?.id &&
                      (activeConversation.createdById === user?.id ||
                        user?.role === 'OWNER') && (
                        <button
                          className="chat-remove-member-btn"
                          onClick={() => setMemberToRemove(member)}
                          title={t('messaging.removeMember')}
                        >
                          <X size={14} />
                        </button>
                      )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ─── MODALS ────────────────────────────────── */}

          {/* Clear Chat Confirm */}
          {showClearConfirm && (
            <div className="chat-modal-overlay" onClick={() => setShowClearConfirm(false)}>
              <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
                <p>{t('messaging.clearChatConfirm')}</p>
                <div className="chat-modal__actions">
                  <button
                    className="chat-modal__btn chat-modal__btn--cancel"
                    onClick={() => setShowClearConfirm(false)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    className="chat-modal__btn chat-modal__btn--danger"
                    onClick={handleClearChat}
                  >
                    {t('messaging.clearChat')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Leave Group Confirm */}
          {showLeaveConfirm && (
            <div className="chat-modal-overlay" onClick={() => setShowLeaveConfirm(false)}>
              <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
                <p>{t('messaging.leaveGroupConfirm')}</p>
                <div className="chat-modal__actions">
                  <button
                    className="chat-modal__btn chat-modal__btn--cancel"
                    onClick={() => setShowLeaveConfirm(false)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    className="chat-modal__btn chat-modal__btn--danger"
                    onClick={handleLeaveGroup}
                  >
                    {t('messaging.leaveGroup')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Remove Member Confirm */}
          {memberToRemove && (
            <div className="chat-modal-overlay" onClick={() => setMemberToRemove(null)}>
              <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
                <p>
                  {t('messaging.removeMemberConfirm', {
                    name: `${memberToRemove.firstName} ${memberToRemove.lastName}`,
                  })}
                </p>
                <div className="chat-modal__actions">
                  <button
                    className="chat-modal__btn chat-modal__btn--cancel"
                    onClick={() => setMemberToRemove(null)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    className="chat-modal__btn chat-modal__btn--danger"
                    onClick={handleRemoveMember}
                  >
                    {t('messaging.removeMember')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
