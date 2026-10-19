import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Conversation, ConversationStatus, Lead } from '@gym-helpdesk/shared-types';
import { useAuth } from './context/AuthContext';
import { apiClient } from './api/client';
import { Navbar } from './components/Navbar';
import { Sidebar, NavView } from './components/Sidebar';
import { ConversationList } from './components/ConversationList';
import { ConversationDetail } from './components/ConversationDetail';
import { FollowUpsView } from './components/FollowUpsView';
import { DashboardOverview } from './components/DashboardOverview';

export const App: React.FC = () => {
  const { tenantId, branchId, employeeId, loading: authLoading, error: authError } = useAuth();

  const [activeView, setActiveView] = useState<NavView>('my-conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // Leads & Employee metadata caches
  const [leadsMap, setLeadsMap] = useState<Record<string, Lead>>({});
  const [employeesMap, setEmployeesMap] = useState<Record<string, string>>({});

  // Summary counts for badges
  const [counts, setCounts] = useState({
    open: 0,
    myOpen: 0,
    onHold: 0,
    resolved: 0,
    followUps: 0,
  });

  // Load conversations based on active view, tenant, and filters
  const loadConversations = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    try {
      const isMyConversations = activeView === 'my-conversations';
      const isResolvedView = activeView === 'resolved';

      let effectiveStatus: ConversationStatus | undefined = undefined;
      if (isResolvedView) {
        effectiveStatus = 'resolved';
      } else if (statusFilter !== 'all') {
        effectiveStatus = statusFilter;
      }

      const res = await apiClient.listConversations({
        tenantId,
        branchId: branchId || undefined,
        status: effectiveStatus,
        assignedEmployeeId: isMyConversations && employeeId ? employeeId : undefined,
        page,
        limit: 20,
      });

      setConversations(res.data);
      if (res.meta) {
        setTotalPages(res.meta.totalPages);
      }

      // Fetch lead details for newly discovered leadIds
      const missingLeadIds = Array.from(
        new Set(res.data.map((c) => c.leadId).filter((lid) => !leadsMap[lid])),
      );
      if (missingLeadIds.length > 0) {
        Promise.all(
          missingLeadIds.map(async (lid) => {
            try {
              const l = await apiClient.getLead(lid);
              return { id: lid, lead: l };
            } catch {
              return null;
            }
          }),
        ).then((results) => {
          setLeadsMap((prev) => {
            const updated = { ...prev };
            results.forEach((r) => {
              if (r) updated[r.id] = r.lead;
            });
            return updated;
          });
        });
      }

      // Fetch employees for branch to populate employee name map
      if (branchId) {
        apiClient.listBranchChatAgents(branchId).then((agents) => {
          setEmployeesMap((prev) => {
            const updated = { ...prev };
            agents.forEach((a) => {
              updated[a.employeeId] = a.fullName;
            });
            return updated;
          });
        }).catch(() => {});
      }
    } catch {
      // handled gracefully in UI
    } finally {
      setLoading(false);
    }
  }, [tenantId, branchId, employeeId, activeView, statusFilter, page, leadsMap]);

  // Load badge summary counts
  const loadCounts = useCallback(async () => {
    if (!tenantId) return;
    try {
      // 1. Open count
      const openRes = await apiClient.listConversations({
        tenantId,
        branchId: branchId || undefined,
        status: 'open',
        limit: 1,
      });

      // 2. My chats count
      let myOpenCount = 0;
      if (employeeId) {
        const myRes = await apiClient.listConversations({
          tenantId,
          branchId: branchId || undefined,
          assignedEmployeeId: employeeId,
          limit: 1,
        });
        myOpenCount = myRes.meta?.total || 0;
      }

      // 3. On hold count
      const holdRes = await apiClient.listConversations({
        tenantId,
        branchId: branchId || undefined,
        status: 'on_hold',
        limit: 1,
      });

      // 4. Resolved count
      const resRes = await apiClient.listConversations({
        tenantId,
        branchId: branchId || undefined,
        status: 'resolved',
        limit: 1,
      });

      // 5. Follow-ups count
      const fuRes = await apiClient.listFollowUps({
        tenantId,
        branchId: branchId || undefined,
        status: 'scheduled',
      });

      setCounts({
        open: openRes.meta?.total || 0,
        myOpen: myOpenCount,
        onHold: holdRes.meta?.total || 0,
        resolved: resRes.meta?.total || 0,
        followUps: fuRes.length,
      });
    } catch {
      // fail silently for background counts
    }
  }, [tenantId, branchId, employeeId]);

  useEffect(() => {
    loadConversations();
    loadCounts();
  }, [loadConversations, loadCounts]);

  // Periodic polling every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      loadCounts();
    }, 8000);
    return () => clearInterval(timer);
  }, [loadCounts]);

  // Filter conversations locally if client search query is typed
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase().trim();

    return conversations.filter((c) => {
      if (c.id.toLowerCase().includes(query)) return true;
      const lead = leadsMap[c.leadId];
      if (lead?.name && lead.name.toLowerCase().includes(query)) return true;
      if (lead?.phoneNumber && lead.phoneNumber.includes(query)) return true;
      return false;
    });
  }, [conversations, searchQuery, leadsMap]);

  // Find active conversation
  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return null;
    return conversations.find((c) => c.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  const selectedLead = selectedConversation ? leadsMap[selectedConversation.leadId] || null : null;
  const assignedAgentName = selectedConversation?.assignedEmployeeId
    ? employeesMap[selectedConversation.assignedEmployeeId]
    : undefined;

  const handleSelectView = (view: NavView) => {
    setActiveView(view);
    setSelectedConversationId(null);
    setPage(1);
  };

  if (authLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
        <div className="text-center">
          <div className="spinner-border text-success mb-3" style={{ width: '3rem', height: '3rem' }} role="status"></div>
          <h5 className="fw-bold text-dark">Initializing Helpdesk...</h5>
          <p className="text-muted small">Loading simulated CRM authorization and branch context</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
        <div className="card shadow-sm border-0 p-4 text-center" style={{ maxWidth: '400px' }}>
          <i className="bi bi-shield-x text-danger display-4 mb-3"></i>
          <h5 className="fw-bold">Authentication Error</h5>
          <p className="text-muted small">{authError}</p>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column h-100">
      {/* Top Navigation */}
      <Navbar onRefresh={() => { loadConversations(); loadCounts(); }} />

      {/* Main Workspace Body */}
      <div className="app-container">
        {/* Left Sidebar */}
        <Sidebar
          activeView={activeView}
          onSelectView={handleSelectView}
          openCount={counts.open}
          myCount={counts.myOpen}
          followUpCount={counts.followUps}
        />

        {/* View Router */}
        {activeView === 'overview' ? (
          <DashboardOverview
            openCount={counts.open}
            myCount={counts.myOpen}
            onHoldCount={counts.onHold}
            resolvedCount={counts.resolved}
            followUpCount={counts.followUps}
            onNavigate={handleSelectView}
          />
        ) : activeView === 'follow-ups' ? (
          <FollowUpsView
            onSelectConversation={(cid) => {
              setActiveView('all-conversations');
              setSelectedConversationId(cid);
            }}
          />
        ) : (
          /* Conversation Work Area: 2-column or Mobile Toggle */
          <div className="d-flex flex-grow-1 overflow-hidden">
            {/* Conversation List Pane (hidden on mobile if detail active) */}
            <div className={`h-100 ${selectedConversationId ? 'd-none d-md-block' : 'w-100'}`}>
              <ConversationList
                conversations={filteredConversations}
                leadsMap={leadsMap}
                employeesMap={employeesMap}
                selectedConversationId={selectedConversationId}
                onSelectConversation={(id) => setSelectedConversationId(id)}
                statusFilter={statusFilter}
                onStatusFilterChange={(st) => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                loading={loading}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>

            {/* Conversation Detail Pane (visible if selected, or placeholder on desktop) */}
            <div className={`flex-grow-1 h-100 ${!selectedConversationId ? 'd-none d-md-block' : 'w-100'}`}>
              <ConversationDetail
                conversation={selectedConversation}
                lead={selectedLead}
                assignedAgentName={assignedAgentName}
                onBackToList={() => setSelectedConversationId(null)}
                onConversationUpdated={() => {
                  loadConversations();
                  loadCounts();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
