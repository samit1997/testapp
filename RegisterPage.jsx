import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../utils/api';

const STEPS = ['Identity', 'Company', 'Review'];

const RegisterPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', mobile: '', password: '', confirmPassword: '',
    companyName: '', companyLocation: '', industry: 'Real Estate', purpose: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inp = (k) => ({ value: form[k], onChange: (e) => set(k, e.target.value) });

  const nextStep = () => {
    if (step === 0) {
      if (!form.fullName || !form.email || !form.password) return toast.error('Please fill all required fields');
      if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
      if (form.password.length < 12) return toast.error('Password must be at least 12 characters');
    }
    if (step === 1 && !form.companyName) return toast.error('Company name required');
    setStep((s) => s + 1);
  };

  const submit = async () => {
    setLoading(true);
    try {
      await authAPI.register({
        fullName: form.fullName, email: form.email, mobile: form.mobile,
        companyName: form.companyName, companyLocation: form.companyLocation,
        industry: form.industry, purpose: form.purpose,
      });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={styles.logo}><span style={styles.logoIcon}>V</span><span style={styles.logoText}>VAULTSHARE</span></div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
            <h2 style={{ color: '#e6edf3', marginBottom: 8 }}>Request Submitted!</h2>
            <p style={{ color: '#8b949e', lineHeight: 1.7 }}>
              Your registration has been sent to the admin team.<br />
              Watch <strong style={{ color: '#e6edf3' }}>{form.email}</strong> for approval.<br />
              You'll receive your folder name and credentials by email.
            </p>
            <button style={{ ...styles.btn, marginTop: 20, width: '100%' }} onClick={() => navigate('/login')}>
              Go to Login →
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ color: '#e6edf3', textAlign: 'center', marginBottom: 4 }}>Create Account</h2>
            <p style={{ color: '#8b949e', textAlign: 'center', fontSize: 13, marginBottom: 20 }}>Step {step + 1} of 3 — {STEPS[step]}</p>

            {/* Progress */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 24, alignItems: 'center' }}>
              {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  <div style={{ ...styles.stepDot, background: i <= step ? '#0969da' : '#30363d', color: i <= step ? '#fff' : '#8b949e' }}>{i < step ? '✓' : i + 1}</div>
                  {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? '#0969da' : '#30363d' }} />}
                </React.Fragment>
              ))}
            </div>

            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Full Name *" placeholder="Aravindh Kumar" {...inp('fullName')} />
                <Field label="Email Address *" type="email" placeholder="aravindh@rmz.com" {...inp('email')} />
                <Field label="Mobile Number" placeholder="+65 9123 4567" {...inp('mobile')} />
                <Field label="Password * (min 12 chars)" type="password" placeholder="••••••••••••" {...inp('password')} />
                <Field label="Confirm Password *" type="password" placeholder="••••••••••••" {...inp('confirmPassword')} />
              </div>
            )}

            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Company Name *" placeholder="RMZ Corp" {...inp('companyName')} />
                <Field label="Company Location" placeholder="Singapore, SG" {...inp('companyLocation')} />
                <div>
                  <label style={styles.label}>Industry</label>
                  <select style={styles.input} value={form.industry} onChange={(e) => set('industry', e.target.value)}>
                    {['Real Estate', 'Finance', 'Technology', 'Healthcare', 'Manufacturing', 'Other'].map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Purpose of Access</label>
                  <textarea style={{ ...styles.input, minHeight: 80, resize: 'vertical' }} placeholder="Why do you need access?" {...inp('purpose')} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div style={styles.reviewBox}>
                  <div style={styles.reviewTitle}>REGISTRATION SUMMARY</div>
                  {[
                    ['Name', form.fullName], ['Email', form.email], ['Mobile', form.mobile || '—'],
                    ['Company', form.companyName], ['Location', form.companyLocation || '—'], ['Industry', form.industry],
                  ].map(([k, v]) => (
                    <div key={k} style={styles.reviewRow}>
                      <span style={{ color: '#8b949e' }}>{k}</span>
                      <span style={{ color: '#e6edf3', fontFamily: 'monospace' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={styles.infoBox}>
                  ✓ On submission, admin will be notified. Once approved, you'll receive an email with your shared folder credentials.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {step > 0 && <button style={{ ...styles.btn, background: '#30363d', flex: '0 0 auto', padding: '10px 20px' }} onClick={() => setStep(s => s - 1)}>← Back</button>}
              {step < 2
                ? <button style={{ ...styles.btn, flex: 1 }} onClick={nextStep}>Next →</button>
                : <button style={{ ...styles.btn, flex: 1, background: '#1a7f37', opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
                    {loading ? 'Submitting...' : '✓ Submit Registration'}
                  </button>
              }
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/login" style={{ color: '#8b949e', fontSize: 12, textDecoration: 'none' }}>← Already have an account? Login</Link>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, ...props }) => (
  <div>
    <label style={styles.label}>{label}</label>
    <input style={styles.input} {...props} />
  </div>
);

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0d1117 0%,#161b22 100%)', padding: '2rem' },
  box: { background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 480 },
  logo: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 24 },
  logoIcon: { width: 36, height: 36, background: '#0969da', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'monospace', padding: '0 10px' },
  logoText: { fontFamily: 'monospace', fontSize: 15, fontWeight: 500, color: '#e6edf3', letterSpacing: '0.06em' },
  stepDot: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'monospace', flexShrink: 0 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace', marginBottom: 5 },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #30363d', borderRadius: 6, fontSize: 13, fontFamily: 'sans-serif', color: '#e6edf3', background: '#0d1117', outline: 'none', boxSizing: 'border-box' },
  btn: { padding: '10px 16px', borderRadius: 6, border: 'none', background: '#0969da', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'sans-serif', transition: 'background .12s' },
  reviewBox: { background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '1rem', marginBottom: 12 },
  reviewTitle: { fontSize: 10, color: '#8b949e', fontFamily: 'monospace', marginBottom: 8, letterSpacing: '0.06em' },
  reviewRow: { display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 },
  infoBox: { background: '#1a3a1a', border: '1px solid #1a7f3744', borderRadius: 6, padding: '0.75rem', fontSize: 12, color: '#3fb950' },
};

export default RegisterPage;
