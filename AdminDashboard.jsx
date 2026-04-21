import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import { adminAPI } from '../utils/api';

const fmt = (b) => { if (!b) return '0 B'; const k=1024,s=['B','KB','MB','GB','TB'],i=Math.floor(Math.log(b)/Math.log(k)); return `${(b/Math.pow(k,i)).toFixed(1)} ${s[i]}`; };
const pct = (u, t) => t ? Math.min(100, Math.round((u / t) * 100)) : 0;

// ── Overview Tab ──────────────────────────────────────────────
const OverviewTab = () => {
  const { data } = useQuery({ queryKey: ['admin-storage'], queryFn: () => adminAPI.getStorageStats().then(r => r.data) });
  const { data: reqData } = useQuery({ queryKey: ['admin-requests','pending'], queryFn: () => adminAPI.getRequests({ status: 'pending' }).then(r => r.data) });
  const g = data?.global || {};

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[['Active Users', g.total_users || 0, '+pending approval'], ['Shared Folders', g.total_folders || 0, 'Across companies'], ['Storage Used', fmt(g.total_bytes_used), `of ${fmt(g.total_quota_bytes)}`], ['Files Managed', g.total_files || 0, 'Across all folders']].map(([l, v, s]) => (
          <div key={l} style={as.statCard}>
            <div style={as.statLabel}>{l}</div>
            <div style={as.statValue}>{v}</div>
            <div style={as.statSub}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={as.card}>
          <div style={as.cardHeader}><span style={as.cardTitle}>⏳ Pending Approvals</span>
            {reqData?.total > 0 && <span style={{ ...as.badge, ...as.badgeAmber }}>{reqData.total} new</span>}
          </div>
          {reqData?.requests?.slice(0, 3).map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ ...as.avatar, background: '#dafbe1', color: '#1a7f37' }}>{r.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.full_name}</div>
                <div style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>{r.email} · {r.company_name}</div>
              </div>
            </div>
          ))}
          {!reqData?.requests?.length && <p style={{ fontSize: 13, color: '#8b949e' }}>No pending requests</p>}
        </div>

        <div style={as.card}>
          <div style={as.cardHeader}><span style={as.cardTitle}>💾 Storage by Company</span></div>
          {data?.byCompany?.slice(0, 5).map((c, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                <span style={{ fontWeight: 500 }}>{c.company_name}</span>
                <span style={{ fontFamily: 'monospace', color: '#8b949e' }}>{fmt(c.bytes_used)} / {fmt(c.quota_bytes)}</span>
              </div>
              <div style={{ height: 6, background: '#e8e8e8', borderRadius: 3 }}>
                <div style={{ height: '100%', borderRadius: 3, background: pct(c.bytes_used, c.quota_bytes) > 80 ? '#b08800' : '#0969da', width: `${pct(c.bytes_used, c.quota_bytes)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Requests Tab ──────────────────────────────────────────────
const RequestsTab = () => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ folderName: '', quota: '1 TB', permissions: 'write', tempPassword: '' });

  const { data } = useQuery({ queryKey: ['admin-requests','pending'], queryFn: () => adminAPI.getRequests({ status: 'pending' }).then(r => r.data) });

  const approveMut = useMutation({
    mutationFn: ({ id, data }) => adminAPI.approveRequest(id, data),
    onSuccess: () => {
      toast.success('User approved & email sent!');
      setSelected(null);
      qc.invalidateQueries(['admin-requests']);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Approval failed'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => adminAPI.rejectRequest(id, { reason }),
    onSuccess: () => { toast.success('Request rejected'); qc.invalidateQueries(['admin-requests']); },
  });

  const genPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
      <div style={as.card}>
        <div style={as.cardHeader}><span style={as.cardTitle}>📋 Pending Registration Requests</span><span style={as.badge}>{data?.total || 0}</span></div>
        {data?.requests?.map(r => (
          <div key={r.id} style={{ ...as.requestRow, border: selected?.id === r.id ? '1px solid #0969da' : '1px solid #f0f0f0', background: selected?.id === r.id ? '#f0f7ff' : '#fff' }}
            onClick={() => { setSelected(r); setForm(f => ({ ...f, folderName: r.company_name.replace(/\s+/g,'').toUpperCase().slice(0,4) + 'SG01', tempPassword: genPassword() })); }}>
            <div style={{ ...as.avatar, background: '#ddf4ff', color: '#0969da', marginRight: 12 }}>{r.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.full_name}</div>
              <div style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>{r.email}</div>
              <div style={{ fontSize: 11, color: '#57606a', marginTop: 2 }}>{r.company_name} · {r.company_location}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ ...as.badge, ...as.badgeAmber }}>Pending</span>
              <div style={{ fontSize: 10, color: '#8b949e', marginTop: 4, fontFamily: 'monospace' }}>{new Date(r.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
        {!data?.requests?.length && <p style={{ fontSize: 13, color: '#8b949e', textAlign: 'center', padding: '2rem 0' }}>No pending requests 🎉</p>}
      </div>

      {selected && (
        <div style={{ ...as.card, width: 320 }}>
          <div style={as.cardHeader}><span style={as.cardTitle}>✅ Approve Request</span></div>
          <div style={{ fontSize: 12, color: '#57606a', marginBottom: 12 }}>
            <strong>{selected.full_name}</strong><br />{selected.email}<br />{selected.company_name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['Folder Name', 'folderName', 'text', 'RMZSG01'],['Storage Quota', 'quota', 'text', '1 TB']].map(([l,k,t,p]) => (
              <div key={k}>
                <label style={as.formLabel}>{l}</label>
                <input style={as.formInput} type={t} placeholder={p} value={form[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} />
              </div>
            ))}
            <div>
              <label style={as.formLabel}>Permissions</label>
              <select style={as.formInput} value={form.permissions} onChange={e => setForm(f=>({...f,permissions:e.target.value}))}>
                <option value="write">Read / Write (RW)</option>
                <option value="read">Read Only (RO)</option>
              </select>
            </div>
            <div>
              <label style={as.formLabel}>Temp Password</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...as.formInput, flex: 1, fontFamily: 'monospace', fontSize: 11 }} value={form.tempPassword} onChange={e => setForm(f=>({...f,tempPassword:e.target.value}))} />
                <button style={{ ...as.btnSm, padding: '6px 10px' }} onClick={() => setForm(f=>({...f,tempPassword:genPassword()}))}>↻</button>
              </div>
            </div>
          </div>
          <div style={{ background: '#ddf4ff', border: '1px solid #0969da33', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#0550ae', margin: '12px 0' }}>
            Email will be sent to <strong>{selected.email}</strong> with folder name, temp password & login instructions.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button style={{ ...as.btn, background: '#1a7f37', width: '100%' }}
              onClick={() => approveMut.mutate({ id: selected.id, data: form })}
              disabled={approveMut.isPending || !form.folderName || !form.tempPassword}>
              {approveMut.isPending ? 'Processing...' : '✓ Approve & Notify User'}
            </button>
            <button style={{ ...as.btn, background: '#cf222e', width: '100%' }}
              onClick={() => { if (window.confirm('Reject this request?')) rejectMut.mutate({ id: selected.id, reason: 'Application declined' }); setSelected(null); }}>
              ✗ Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Users Tab ─────────────────────────────────────────────────
const UsersTab = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data } = useQuery({ queryKey: ['admin-users', search], queryFn: () => adminAPI.getUsers({ search }).then(r => r.data) });

  const statusMut = useMutation({
    mutationFn: ({ userId, action }) => adminAPI.updateUserStatus(userId, { action }),
    onSuccess: () => { toast.success('User updated'); qc.invalidateQueries(['admin-users']); },
    onError: () => toast.error('Update failed'),
  });

  return (
    <div style={as.card}>
      <div style={as.cardHeader}>
        <span style={as.cardTitle}>👥 User Management</span>
        <input style={{ ...as.formInput, width: 220 }} placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={as.table}>
          <thead><tr>{['User','Company','Folder','Permissions','2FA','Status','Last Login','Actions'].map(h => <th key={h} style={as.th}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.users?.map(u => (
              <tr key={u.id}>
                <td style={as.td}><div><div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name}</div><div style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>{u.email}</div></div></td>
                <td style={as.td}>{u.company_name || '—'}</td>
                <td style={as.td}><span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f6f8fa', padding: '2px 6px', borderRadius: 4 }}>{u.folder_access?.split(':')[0] || '—'}</span></td>
                <td style={as.td}><span style={{ ...as.badge, ...(u.folder_access?.includes('write') ? as.badgeGreen : as.badgeBlue) }}>{u.folder_access?.includes('write') ? 'RW' : 'RO'}</span></td>
                <td style={as.td}><span style={{ ...as.badge, ...(u.totp_enabled ? as.badgeGreen : as.badgeRed) }}>{u.totp_enabled ? '✓ On' : '✗ Off'}</span></td>
                <td style={as.td}><span style={{ ...as.badge, ...(u.status === 'active' ? as.badgeGreen : u.status === 'suspended' ? as.badgeAmber : as.badgeBlue) }}>{u.status}</span></td>
                <td style={as.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e' }}>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</span></td>
                <td style={as.td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {u.status === 'active'
                      ? <button style={{ ...as.btnSm, color: '#cf222e', borderColor: '#f5a3a3' }} onClick={() => statusMut.mutate({ userId: u.id, action: 'suspend' })}>Suspend</button>
                      : <button style={{ ...as.btnSm, color: '#1a7f37', borderColor: '#a0d9b0' }} onClick={() => statusMut.mutate({ userId: u.id, action: 'reinstate' })}>Reinstate</button>
                    }
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Folders Tab ───────────────────────────────────────────────
const FoldersTab = () => {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newFolder, setNewFolder] = useState({ folderName: '', quota: '1 TB', description: '' });
  const { data } = useQuery({ queryKey: ['admin-folders'], queryFn: () => adminAPI.getFolders().then(r => r.data) });

  const createMut = useMutation({
    mutationFn: (data) => adminAPI.createFolder(data),
    onSuccess: () => { toast.success('Folder created on S3'); setShowNew(false); qc.invalidateQueries(['admin-folders']); },
    onError: (e) => toast.error(e.response?.data?.error || 'Create failed'),
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button style={as.btn} onClick={() => setShowNew(s => !s)}>+ Create Folder</button>
      </div>
      {showNew && (
        <div style={{ ...as.card, marginBottom: 16, borderColor: '#0969da' }}>
          <div style={as.cardHeader}><span style={as.cardTitle}>📁 New Shared Folder</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Folder Name','folderName','text','RMZSG01'],['Storage Quota','quota','text','1 TB']].map(([l,k,t,p]) => (
              <div key={k}><label style={as.formLabel}>{l}</label><input style={as.formInput} type={t} placeholder={p} value={newFolder[k]} onChange={e => setNewFolder(f=>({...f,[k]:e.target.value}))} /></div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}><label style={as.formLabel}>Description (optional)</label><input style={as.formInput} placeholder="Description..." value={newFolder.description} onChange={e => setNewFolder(f=>({...f,description:e.target.value}))} /></div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#ddf4ff', borderRadius: 6, fontSize: 12, color: '#0550ae', fontFamily: 'monospace' }}>
            S3 Path: s3://{process.env.REACT_APP_S3_BUCKET || 'vaultshare-prod'}/{newFolder.folderName || '<folder-name>'}/
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={as.btn} onClick={() => createMut.mutate(newFolder)} disabled={createMut.isPending || !newFolder.folderName}>
              {createMut.isPending ? 'Creating...' : 'Create on S3 →'}
            </button>
            <button style={{ ...as.btnSm, padding: '8px 16px' }} onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div style={as.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={as.table}>
            <thead><tr>{['Folder','Company','Users','S3 Path','Quota','Used','Encryption','Status'].map(h => <th key={h} style={as.th}>{h}</th>)}</tr></thead>
            <tbody>
              {data?.folders?.map(f => (
                <tr key={f.id}>
                  <td style={as.td}><strong style={{ fontFamily: 'monospace' }}>{f.folder_name}</strong></td>
                  <td style={as.td}>{f.company_name || '—'}</td>
                  <td style={as.td}>{f.user_count}</td>
                  <td style={as.td}><span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8b949e' }}>s3://vaultshare-prod/{f.folder_name}/</span></td>
                  <td style={as.td}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmt(f.quota_bytes)}</span></td>
                  <td style={as.td}>
                    <div style={{ height: 5, background: '#e8e8e8', borderRadius: 3, width: 80, marginBottom: 2 }}>
                      <div style={{ height: '100%', background: '#0969da', borderRadius: 3, width: `${pct(f.used_bytes, f.quota_bytes)}%` }} />
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8b949e' }}>{fmt(f.used_bytes)}</span>
                  </td>
                  <td style={as.td}><span style={{ ...as.badge, ...as.badgeGreen }}>AES-256</span></td>
                  <td style={as.td}><span style={{ ...as.badge, ...(f.is_active ? as.badgeGreen : as.badgeAmber) }}>{f.is_active ? 'Active' : 'Disabled'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Audit Log Tab ─────────────────────────────────────────────
const AuditLogTab = () => {
  const { data } = useQuery({ queryKey: ['admin-audit'], queryFn: () => adminAPI.getAuditLog({ limit: 100 }).then(r => r.data) });

  const statusColors = { success: as.badgeGreen, failure: as.badgeRed, warning: as.badgeAmber };

  return (
    <div style={as.card}>
      <div style={as.cardHeader}><span style={as.cardTitle}>🔒 Security Audit Log</span><span style={{ fontSize: 12, color: '#8b949e' }}>Last 100 events</span></div>
      <div style={{ overflowX: 'auto' }}>
        <table style={as.table}>
          <thead><tr>{['Timestamp','User','Action','Resource','IP Address','Status'].map(h => <th key={h} style={as.th}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.logs?.map((log, i) => (
              <tr key={i}>
                <td style={as.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e' }}>{new Date(log.created_at).toLocaleString()}</span></td>
                <td style={as.td}><span style={{ fontSize: 12 }}>{log.user_email || '—'}</span></td>
                <td style={as.td}><span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>{log.action}</span></td>
                <td style={as.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e' }}>{log.resource_name || '—'}</span></td>
                <td style={as.td}><span style={{ fontSize: 11, fontFamily: 'monospace' }}>{log.ip_address || '—'}</span></td>
                <td style={as.td}><span style={{ ...as.badge, ...(statusColors[log.status] || as.badgeGreen) }}>{log.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Main Admin Dashboard ──────────────────────────────────────
const ADMIN_TABS = [
  { label: 'Overview', component: OverviewTab },
  { label: 'Requests', component: RequestsTab, badge: 'requests' },
  { label: 'Users', component: UsersTab },
  { label: 'Folders', component: FoldersTab },
  { label: 'Audit Log', component: AuditLogTab },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [tab, setTab] = useState(0);
  const { data: reqData } = useQuery({ queryKey: ['admin-requests','pending'], queryFn: () => adminAPI.getRequests({ status: 'pending' }).then(r => r.data) });
  const ActiveComponent = ADMIN_TABS[tab].component;

  const handleLogout = async () => { await logout(); navigate('/admin/login'); };

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fa' }}>
      <nav style={{ ...as.nav, borderBottom: '1px solid #8250df33' }}>
        <div style={as.navBrand}>
          <div style={{ ...as.navLogo, background: '#8250df' }}>A</div>
          VAULTSHARE <span style={{ color: '#8250df', fontSize: 10, marginLeft: 4, fontFamily: 'monospace' }}>ADMIN</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {ADMIN_TABS.map((t, i) => (
            <button key={t.label} style={{ ...as.navTab, ...(tab === i ? as.navTabActive : {}) }} onClick={() => setTab(i)}>
              {t.label}
              {t.badge === 'requests' && reqData?.total > 0 && (
                <span style={{ ...as.badge, ...as.badgeRed, marginLeft: 6, fontSize: 9 }}>{reqData.total}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...as.badge, background: '#8250df22', color: '#b083f0', border: '1px solid #8250df44', fontSize: 10 }}>SUPER ADMIN</span>
          <span style={{ fontSize: 12, color: '#8b949e' }}>{user?.email}</span>
          <button style={as.btnNav} onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0d1117', marginBottom: 4 }}>{ADMIN_TABS[tab].label}</h1>
          <p style={{ fontSize: 12, color: '#8b949e', fontFamily: 'monospace' }}>AWS ap-southeast-1 · MySQL RDS · S3 · Admin session</p>
        </div>
        <ActiveComponent />
      </div>
    </div>
  );
};

const as = {
  nav: { background: '#0d1117', color: '#fff', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, position: 'sticky', top: 0, zIndex: 100 },
  navBrand: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace', fontSize: 13, fontWeight: 500, color: '#e6edf3' },
  navLogo: { width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' },
  navTab: { padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#8b949e', border: 'none', background: 'none', fontFamily: 'sans-serif' },
  navTabActive: { color: '#fff', background: 'rgba(255,255,255,.12)' },
  btnNav: { padding: '5px 12px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', fontSize: 12, cursor: 'pointer' },
  card: { background: '#fff', border: '1px solid #d0d7de', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: 0 },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' },
  cardTitle: { fontSize: 13, fontWeight: 600, color: '#24292f' },
  statCard: { background: '#fff', border: '1px solid #d0d7de', borderRadius: 8, padding: '1rem 1.25rem' },
  statLabel: { fontSize: 11, fontWeight: 500, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontFamily: 'monospace' },
  statValue: { fontSize: 26, fontWeight: 700, color: '#0d1117', lineHeight: 1, fontFamily: 'monospace' },
  statSub: { fontSize: 11, color: '#8b949e', marginTop: 4 },
  badge: { padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', fontFamily: 'monospace', whiteSpace: 'nowrap' },
  badgeGreen: { background: '#dafbe1', color: '#1a7f37' },
  badgeBlue: { background: '#ddf4ff', color: '#0969da' },
  badgeRed: { background: '#ffebe9', color: '#cf222e' },
  badgeAmber: { background: '#fff8c5', color: '#9a6700' },
  btn: { padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0969da', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'sans-serif' },
  btnSm: { padding: '4px 10px', borderRadius: 5, border: '1px solid #d0d7de', background: '#f6f8fa', color: '#24292f', fontSize: 11, cursor: 'pointer', fontFamily: 'sans-serif' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', borderBottom: '1px solid #d0d7de', background: '#f6f8fa', fontFamily: 'monospace' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle', color: '#24292f' },
  avatar: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, fontFamily: 'monospace' },
  requestRow: { display: 'flex', alignItems: 'center', padding: '10px', borderRadius: 8, cursor: 'pointer', marginBottom: 8, transition: 'border .15s' },
  formLabel: { display: 'block', fontSize: 11, fontWeight: 600, color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace', marginBottom: 5 },
  formInput: { width: '100%', padding: '7px 10px', border: '1px solid #d0d7de', borderRadius: 6, fontSize: 13, fontFamily: 'sans-serif', color: '#0d1117', outline: 'none', boxSizing: 'border-box' },
};

export default AdminDashboard;
