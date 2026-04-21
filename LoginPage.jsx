import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';

const LoginPage = ({ isAdmin = false }) => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [step, setStep] = useState('credentials'); // 'credentials' | 'totp'
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  const handleCredentials = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Email and password required');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requiresTOTP) {
        setStep('totp');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else if (result.success) {
        const dest = result.user.role === 'admin' ? '/admin' : '/dashboard';
        navigate(dest);
        toast.success(`Welcome back, ${result.user.fullName?.split(' ')[0]}!`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const handleOtpChange = (i, val) => {
    const cleaned = val.replace(/\D/, '');
    const next = [...otp];
    next[i] = cleaned;
    setOtp(next);
    if (cleaned && i < 5) otpRefs.current[i + 1]?.focus();
    if (next.every(d => d) && next.join('').length === 6) {
      submitTotp(next.join(''));
    }
  };

  const handleOtpKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const submitTotp = async (code) => {
    setLoading(true);
    try {
      const result = await login(email, password, code);
      if (result.success) {
        navigate(result.user.role === 'admin' ? '/admin' : '/dashboard');
        toast.success('Authenticated successfully');
      }
    } catch (err) {
      toast.error(err.message || 'Invalid 2FA code');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const accentColor = isAdmin ? '#8250df' : '#0969da';
  const borderColor = isAdmin ? '#8250df44' : '#30363d';
  const bgColor = isAdmin ? '#12091f' : '#161b22';

  return (
    <div style={s.page}>
      <div style={{ ...s.box, borderColor, background: bgColor }}>
        {/* Logo */}
        <div style={s.logo}>
          <div style={{ ...s.logoIcon, background: accentColor }}>{isAdmin ? 'A' : 'V'}</div>
          <div>
            <div style={{ ...s.logoText, color: isAdmin ? '#e2c9ff' : '#e6edf3' }}>
              {isAdmin ? 'ADMIN CONSOLE' : 'VAULTSHARE'}
            </div>
            <div style={{ fontSize: 10, color: '#8b949e', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
              {isAdmin ? 'PRIVILEGED ACCESS · ALL ACTIONS LOGGED' : 'ENTERPRISE FILE MANAGEMENT'}
            </div>
          </div>
        </div>

        {step === 'credentials' ? (
          <>
            <h2 style={{ ...s.title, color: isAdmin ? '#e2c9ff' : '#e6edf3' }}>
              {isAdmin ? 'Administrator Sign In' : 'Sign In'}
            </h2>
            <p style={s.subtitle}>
              {isAdmin ? 'Privileged access — your session will be fully audited' : 'Enter your credentials to access your shared folders'}
            </p>

            <form onSubmit={handleCredentials} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={s.label}>Email Address</label>
                <input style={s.input} type="email" placeholder="you@company.com"
                  value={email} onChange={e => setEmail(e.target.value)} autoFocus />
              </div>
              <div>
                <label style={s.label}>Password</label>
                <input style={s.input} type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <button type="submit" style={{ ...s.btn, background: accentColor, opacity: loading ? 0.7 : 1 }} disabled={loading}>
                {loading ? 'Signing in...' : 'Continue →'}
              </button>
            </form>

            <div style={s.divider}><span>Security</span></div>
            <div style={s.securityBadge}>
              <span style={{ ...s.dot, background: '#1a7f37' }} /> TLS 1.3 · AES-256 · TOTP 2FA required
            </div>

            {!isAdmin && (
              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#8b949e' }}>
                Don't have an account?{' '}
                <Link to="/register" style={{ color: accentColor }}>Register here</Link>
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Link to="/" style={{ color: '#8b949e', fontSize: 11, textDecoration: 'none' }}>← Back</Link>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
              <h2 style={{ ...s.title, color: '#e6edf3' }}>Two-Factor Authentication</h2>
              <p style={{ ...s.subtitle, lineHeight: 1.6 }}>
                Enter the 6-digit code from your authenticator app<br />
                <span style={{ fontSize: 11, color: '#8b949e' }}>Google Authenticator · Authy · Microsoft Authenticator</span>
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, margin: '16px 0' }}>
              {otp.map((digit, i) => (
                <input key={i} ref={el => otpRefs.current[i] = el}
                  style={s.otpInput} type="text" inputMode="numeric"
                  maxLength={1} value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)} />
              ))}
            </div>

            <button style={{ ...s.btn, background: accentColor, width: '100%', opacity: loading ? 0.7 : 1 }}
              onClick={() => submitTotp(otp.join(''))} disabled={loading || otp.join('').length < 6}>
              {loading ? 'Verifying...' : 'Verify & Sign In →'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 12, cursor: 'pointer' }}
                onClick={() => { setStep('credentials'); setOtp(['','','','','','']); }}>
                ← Back to login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0d1117 0%,#161b22 100%)', padding: '2rem' },
  box: { border: '1px solid', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 420 },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, justifyContent: 'center' },
  logoIcon: { width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'monospace' },
  logoText: { fontFamily: 'monospace', fontSize: 14, fontWeight: 500, letterSpacing: '0.06em' },
  title: { fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 6 },
  subtitle: { color: '#8b949e', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace', marginBottom: 5 },
  input: { width: '100%', padding: '10px 13px', border: '1px solid #30363d', borderRadius: 6, fontSize: 14, color: '#e6edf3', background: '#0d1117', outline: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' },
  btn: { width: '100%', padding: 11, borderRadius: 6, border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'sans-serif' },
  otpInput: { padding: '11px 0', border: '1px solid #30363d', borderRadius: 6, fontSize: 20, fontWeight: 700, color: '#e6edf3', background: '#0d1117', textAlign: 'center', width: '100%', outline: 'none', fontFamily: 'monospace' },
  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', color: '#8b949e', fontSize: 11 },
  securityBadge: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: '#8b949e', fontFamily: 'monospace' },
  dot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
};

export default LoginPage;
