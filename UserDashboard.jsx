import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import { userAPI, fileAPI } from '../utils/api';

const fmt = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const fileIcon = (mime = '') => {
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('image')) return '🖼️';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('text')) return '📃';
  return '📁';
};

// ── Sub-Components ────────────────────────────────────────────

const Sidebar = ({ folders, selected, onSelect }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={cs.card}>
      <div style={cs.cardHeader}><span style={cs.cardTitle}>📁 My Folders</span></div>
      {!folders?.length
        ? <p style={{ fontSize: 13, color: '#8b949e', padding: '4px 0' }}>No folders assigned yet</p>
        : folders.map(f => (
          <div key={f.id} onClick={() => onSelect(f)}
            style={{ ...cs.folderItem, background: selected?.id === f.id ? '#ddf4ff' : 'transparent', border: `1px solid ${selected?.id === f.id ? '#0969da33' : 'transparent'}` }}>
            <span style={{ fontSize: 18 }}>📁</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{f.folder_name}</div>
              <div style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>{f.company_name}</div>
            </div>
            <span style={{ ...cs.badge, ...(f.permission === 'write' ? cs.badgeGreen : cs.badgeBlue) }}>
              {f.permission === 'write' ? 'RW' : 'RO'}
            </span>
          </div>
        ))
      }
    </div>

    {/* Storage gauge */}
    {folders?.[0] && (
      <div style={cs.card}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e', marginBottom: 6 }}>STORAGE USED</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
          <span>{fmt(folders[0].used_bytes)}</span>
          <span style={{ color: '#8b949e' }}>{fmt(folders[0].quota_bytes)}</span>
        </div>
        <div style={{ height: 6, background: '#e8e8e8', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#0969da,#8250df)', width: `${Math.min(100, (folders[0].used_bytes / folders[0].quota_bytes) * 100)}%` }} />
        </div>
        <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4, fontFamily: 'monospace' }}>
          {Math.round((folders[0].used_bytes / folders[0].quota_bytes) * 100)}% of quota used
        </div>
      </div>
    )}
  </div>
);

const FileBrowser = ({ folder, user }) => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['files', folder?.id, search],
    queryFn: () => fileAPI.list(folder.id, { search }).then(r => r.data),
    enabled: !!folder,
  });

  const deleteMut = useMutation({
    mutationFn: (fileId) => fileAPI.delete(fileId),
    onSuccess: () => { toast.success('File deleted'); qc.invalidateQueries(['files', folder.id]); },
    onError: () => toast.error('Delete failed'),
  });

  const onDrop = useCallback(async (accepted) => {
    if (!folder) return toast.error('Select a folder first');
    if (folder.permission !== 'write') return toast.error('You have read-only access');

    const fd = new FormData();
    accepted.forEach(f => fd.append('files', f));

    setUploading(true);
    try {
      await fileAPI.upload(folder.id, fd, setUploadProgress);
      toast.success(`${accepted.length} file(s) uploaded`);
      qc.invalidateQueries(['files', folder.id]);
      qc.invalidateQueries(['folders']);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); setUploadProgress(0); }
  }, [folder, qc]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploading || folder?.permission !== 'write',
    maxSize: 500 * 1024 * 1024,
  });

  const handleDownload = async (file) => {
    try {
      const { data } = await fileAPI.download(file.id);
      window.open(data.downloadUrl, '_blank');
    } catch { toast.error('Download failed'); }
  };

  if (!folder) return (
    <div style={{ ...cs.card, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 12, color: '#8b949e' }}>
      <div style={{ fontSize: 40 }}>📂</div>
      <p>Select a folder from the sidebar</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Upload zone */}
      {folder.permission === 'write' && (
        <div {...getRootProps()} style={{ ...cs.dropzone, borderColor: isDragActive ? '#0969da' : '#d0d7de', background: isDragActive ? '#f0f7ff' : '#fafafa' }}>
          <input {...getInputProps()} />
          {uploading ? (
            <div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Uploading... {uploadProgress}%</div>
              <div style={{ height: 6, background: '#e8e8e8', borderRadius: 3, width: 200 }}>
                <div style={{ height: '100%', background: '#0969da', borderRadius: 3, width: `${uploadProgress}%`, transition: 'width .2s' }} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⬆</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                {isDragActive ? 'Drop files here' : 'Drag & drop files, or click to browse'}
              </div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>Max 500MB per file · PDF, DOCX, XLSX, PNG, ZIP</div>
            </>
          )}
        </div>
      )}

      {/* File list */}
      <div style={cs.card}>
        <div style={{ ...cs.cardHeader, marginBottom: 12 }}>
          <span style={cs.cardTitle}>📂 {folder.folder_name}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ ...cs.badge, ...(folder.permission === 'write' ? cs.badgeGreen : cs.badgeBlue) }}>
              {folder.permission === 'write' ? 'Read / Write' : 'Read Only'}
            </span>
            <input style={{ ...cs.searchInput }} placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8b949e' }}>Loading files...</div>
        ) : !data?.files?.length ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#8b949e' }}>
            {search ? 'No files match your search' : 'No files in this folder yet'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={cs.table}>
              <thead>
                <tr>{['File', 'Type', 'Size', 'Uploaded By', 'Date', 'Actions'].map(h => <th key={h} style={cs.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.files.map(file => (
                  <tr key={file.id} style={cs.tr}>
                    <td style={cs.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{fileIcon(file.mime_type)}</span>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{file.original_name}</span>
                      </div>
                    </td>
                    <td style={cs.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e' }}>{file.mime_type?.split('/')[1]?.toUpperCase() || '—'}</span></td>
                    <td style={cs.td}><span style={{ fontSize: 11, fontFamily: 'monospace' }}>{fmt(file.size_bytes)}</span></td>
                    <td style={cs.td}><span style={{ fontSize: 12, color: '#57606a' }}>{file.uploaded_by_name}</span></td>
                    <td style={cs.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e' }}>{new Date(file.created_at).toLocaleDateString()}</span></td>
                    <td style={cs.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={cs.btnSm} onClick={() => handleDownload(file)}>⬇ Download</button>
                        {folder.permission === 'write' && (
                          <button style={{ ...cs.btnSm, background: '#ffebe9', color: '#cf222e', border: '1px solid #f5a3a3' }}
                            onClick={() => { if (window.confirm('Delete this file?')) deleteMut.mutate(file.id); }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const ActivityLog = ({ userId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => userAPI.getActivity().then(r => r.data),
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#8b949e' }}>Loading...</div>;

  return (
    <div style={cs.card}>
      <div style={cs.cardHeader}><span style={cs.cardTitle}>📋 Recent Activity</span></div>
      {data?.activity?.map((log, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ ...cs.avatar, background: log.status === 'success' ? '#dafbe1' : '#ffebe9', color: log.status === 'success' ? '#1a7f37' : '#cf222e' }}>
            {log.action === 'FILE_UPLOAD' ? '⬆' : log.action === 'FILE_DOWNLOAD' ? '⬇' : log.action.includes('LOGIN') ? '🔑' : '📋'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#24292f' }}>
              <strong>{log.action.replace(/_/g, ' ')}</strong>
              {log.resource_name && <> — {log.resource_name}</>}
            </div>
            <div style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace', marginTop: 2 }}>
              {new Date(log.created_at).toLocaleString()} · {log.ip_address}
            </div>
          </div>
          <span style={{ ...cs.badge, ...(log.status === 'success' ? cs.badgeGreen : cs.badgeRed) }}>
            {log.status}
          </span>
        </div>
      ))}
    </div>
  );
};

const ProfileTab = ({ user }) => {
  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => userAPI.getProfile().then(r => r.data),
  });
  const p = profileData?.user || user;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={cs.card}>
        <div style={cs.cardHeader}><span style={cs.cardTitle}>👤 Account Details</span></div>
        {[['Full Name', p?.full_name], ['Email', p?.email], ['Mobile', p?.mobile || '—'], ['Company', p?.company_name || '—'], ['Location', p?.location || '—'], ['Member Since', p?.created_at ? new Date(p.created_at).toLocaleDateString() : '—']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #f6f8fa' }}>
            <span style={{ color: '#8b949e' }}>{k}</span>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={cs.card}>
        <div style={cs.cardHeader}><span style={cs.cardTitle}>🔐 Security</span></div>
        <div style={{ background: '#dafbe1', border: '1px solid #1a7f3733', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#1a7f37', marginBottom: 12 }}>
          ✓ Two-Factor Authentication is {p?.totp_enabled ? 'enabled' : 'disabled'}
        </div>
        {!p?.totp_enabled && (
          <div style={{ background: '#fff8c5', border: '1px solid #b0880033', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#9a6700', marginBottom: 12 }}>
            ⚠ Enable 2FA to increase your account security
          </div>
        )}
        <div style={{ fontSize: 13, color: '#57606a', lineHeight: 1.6, marginBottom: 12 }}>
          Use Google Authenticator, Authy, or Microsoft Authenticator. Your TOTP secret is stored encrypted on our servers.
        </div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e', marginTop: 8 }}>
          Last login: {p?.last_login_at ? new Date(p.last_login_at).toLocaleString() : '—'} · {p?.last_login_ip || '—'}
        </div>
      </div>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────

const TABS = ['My Folders', 'Activity', 'Profile'];

const UserDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [tab, setTab] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState(null);

  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: () => userAPI.getFolders().then(r => r.data),
  });
  const folders = foldersData?.folders || [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fa' }}>
      {/* Nav */}
      <nav style={cs.nav}>
        <div style={cs.navBrand}><div style={cs.navLogo}>V</div>VAULTSHARE</div>
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map((t, i) => (
            <button key={t} style={{ ...cs.navTab, ...(tab === i ? cs.navTabActive : {}) }} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a7f37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
            {user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <span style={{ fontSize: 12, color: '#8b949e' }}>{user?.email}</span>
          <span style={{ ...cs.badge, background: '#1a7f3722', color: '#3fb950', border: '1px solid #1a7f3744', fontSize: 10, letterSpacing: '0.05em' }}>USER</span>
          <button style={cs.btnNav} onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
        {tab === 0 && (
          <>
            <div style={cs.pageHeader}>
              <div>
                <h1 style={cs.h1}>My File Vault</h1>
                <p style={{ color: '#8b949e', fontSize: 14 }}>Manage and access your allocated shared folders</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
              <Sidebar folders={folders} selected={selectedFolder} onSelect={setSelectedFolder} />
              <FileBrowser folder={selectedFolder} user={user} />
            </div>
          </>
        )}
        {tab === 1 && (
          <>
            <div style={cs.pageHeader}><h1 style={cs.h1}>Activity Log</h1></div>
            <ActivityLog userId={user?.id} />
          </>
        )}
        {tab === 2 && (
          <>
            <div style={cs.pageHeader}><h1 style={cs.h1}>Profile & Security</h1></div>
            <ProfileTab user={user} />
          </>
        )}
      </div>
    </div>
  );
};

// ── Shared Styles ─────────────────────────────────────────────
const cs = {
  nav: { background: '#0d1117', color: '#fff', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, position: 'sticky', top: 0, zIndex: 100 },
  navBrand: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace', fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', color: '#e6edf3' },
  navLogo: { width: 28, height: 28, background: '#0969da', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' },
  navTab: { padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#8b949e', border: 'none', background: 'none', fontFamily: 'sans-serif', transition: 'all .15s' },
  navTabActive: { color: '#fff', background: 'rgba(255,255,255,.12)' },
  btnNav: { padding: '5px 12px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', fontSize: 12, cursor: 'pointer', fontFamily: 'sans-serif' },
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 },
  h1: { fontSize: 22, fontWeight: 700, color: '#0d1117', margin: 0, marginBottom: 4 },
  card: { background: '#fff', border: '1px solid #d0d7de', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: 0 },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' },
  cardTitle: { fontSize: 13, fontWeight: 600, color: '#24292f', display: 'flex', alignItems: 'center', gap: 6 },
  folderItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4 },
  dropzone: { border: '2px dashed', borderRadius: 8, padding: '2rem', textAlign: 'center', cursor: 'pointer', marginBottom: 0 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #d0d7de', background: '#f6f8fa', fontFamily: 'monospace' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle', color: '#24292f' },
  tr: {},
  badge: { padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', fontFamily: 'monospace', whiteSpace: 'nowrap' },
  badgeGreen: { background: '#dafbe1', color: '#1a7f37' },
  badgeBlue: { background: '#ddf4ff', color: '#0969da' },
  badgeRed: { background: '#ffebe9', color: '#cf222e' },
  btnSm: { padding: '4px 10px', borderRadius: 5, border: '1px solid #d0d7de', background: '#f6f8fa', color: '#24292f', fontSize: 11, cursor: 'pointer', fontFamily: 'sans-serif' },
  searchInput: { padding: '5px 10px', border: '1px solid #d0d7de', borderRadius: 6, fontSize: 12, fontFamily: 'sans-serif', outline: 'none', width: 180 },
  avatar: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
};

export default UserDashboard;
