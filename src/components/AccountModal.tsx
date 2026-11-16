import { useEffect, useState } from 'react';
import {
  Check,
  Globe2,
  GraduationCap,
  Layers,
  LogOut,
  ShieldCheck,
  Star,
  TrendingUp,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import {
  CORE_SUBJECTS,
  COUNTRIES,
  CURRICULA,
  EDUCATION_LEVELS,
  GRADE_OPTIONS_BY_LEVEL,
  LANGUAGE_SUBJECTS,
  UNIVERSITY_YEARS,
} from '../data/curriculum';
import {
  getDefaultGradeForLevel,
  validateCreateAccount,
  validateEducationSetup,
} from '../utils/alexynLogic';
import type { EducationProfile } from '../types/alexyn';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  profile: EducationProfile;
  onSaveProfile: (next: EducationProfile) => void;
  onLogOutAccount: () => void;
  onOpenProgress?: () => void;
  progressSummary?: { overallAverage: number; totalAttempts: number };
}

type ModalTab =
  | 'choice'
  | 'guest-status'
  | 'profile'
  | 'signin'
  | 'create'
  | 'education'
  | 'subjects';

interface StoredUserAccount {
  name: string;
  email: string;
  age?: string;
  password: string;
  country: string;
  curriculum: string;
  educationLevel: EducationProfile['educationLevel'];
  grade: string;
  universityYear?: string;
  subjects: string[];
}

const USERS_KEY = 'alexyn_registered_users_v1';

function loadUsers(): StoredUserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUserAccount[]) : [];
  } catch {
    return [];
  }
}

function saveUserAccount(user: StoredUserAccount) {
  try {
    const existing = loadUsers().filter(
      (u) => u.email.toLowerCase() !== user.email.toLowerCase()
    );
    localStorage.setItem(USERS_KEY, JSON.stringify([user, ...existing]));
  } catch {
    // ignore storage errors
  }
}

function getInitialModalTab(profile: EducationProfile): ModalTab {
  if (profile.mode === 'signed-in') return 'profile';
  if (profile.mode === 'guest' && profile.guestConfirmed) return 'guest-status';
  return 'choice';
}

export function AccountModal({
  open,
  onClose,
  profile,
  onSaveProfile,
  onLogOutAccount,
  onOpenProgress,
  progressSummary,
}: AccountModalProps) {
  const [tab, setTab] = useState<ModalTab>(() => getInitialModalTab(profile));
  const [signInEmail, setSignInEmail] = useState(profile.email || '');
  const [signInPassword, setSignInPassword] = useState('');
  const [name, setName] = useState(profile.name || '');
  const [email, setEmail] = useState(profile.email || '');
  const [age, setAge] = useState(profile.age || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [country, setCountry] = useState(profile.country || 'Kenya');
  const [curriculum, setCurriculum] = useState(profile.curriculum || 'CBC (Kenya)');
  const [educationLevel, setEducationLevel] = useState<EducationProfile['educationLevel']>(
    profile.educationLevel || 'Secondary'
  );
  const [grade, setGrade] = useState(profile.grade || 'Grade 10 / Form 4 / Year 10');
  const [universityYear, setUniversityYear] = useState(
    profile.universityYear || UNIVERSITY_YEARS[0]
  );
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    profile.subjects.length > 0 ? profile.subjects : ['Mathematics', 'English', 'Biology', 'French']
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(getInitialModalTab(profile));
      setCountry(profile.country || 'Kenya');
      setCurriculum(profile.curriculum || 'CBC (Kenya)');
      setEducationLevel(profile.educationLevel || 'Secondary');
      setGrade(profile.grade || 'Grade 10 / Form 4 / Year 10');
      setUniversityYear(profile.universityYear || UNIVERSITY_YEARS[0]);
      setSelectedSubjects(
        profile.subjects.length > 0
          ? profile.subjects
          : ['Mathematics', 'English', 'Biology', 'French']
      );
      setErrorMsg(null);
      setStatusMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const isHigherEd = educationLevel === 'College' || educationLevel === 'University';
  const gradeOptions =
    educationLevel && GRADE_OPTIONS_BY_LEVEL[educationLevel]
      ? GRADE_OPTIONS_BY_LEVEL[educationLevel]
      : GRADE_OPTIONS_BY_LEVEL.Secondary;

  const handleEducationLevelChange = (nextLevel: EducationProfile['educationLevel']) => {
    setEducationLevel(nextLevel);
    const defaultVal = getDefaultGradeForLevel(nextLevel);
    if (nextLevel === 'University') {
      setUniversityYear(UNIVERSITY_YEARS[0]);
      setGrade('');
    } else if (nextLevel === 'College') {
      setUniversityYear(GRADE_OPTIONS_BY_LEVEL.College[1]);
      setGrade('');
    } else {
      setGrade(defaultVal);
    }
  };

  const toggleSubject = (subjectName: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectName)
        ? prev.filter((item) => item !== subjectName)
        : [...prev, subjectName]
    );
  };

  const handleUseGuest = () => {
    onSaveProfile({
      ...profile,
      mode: 'guest',
      guestConfirmed: true,
      name: '',
      email: '',
    });
    onClose();
  };

  const handleLeaveGuest = () => {
    onSaveProfile({
      ...profile,
      mode: 'guest',
      guestConfirmed: false,
    });
    setStatusMsg(null);
    setErrorMsg(null);
    setTab('choice');
  };

  const handleSignIn = () => {
    setErrorMsg(null);
    if (!signInEmail.trim() || !signInEmail.includes('@') || !signInPassword.trim()) {
      setErrorMsg('Please enter your account email and password.');
      return;
    }

    const users = loadUsers();
    const matched = users.find(
      (u) => u.email.toLowerCase() === signInEmail.trim().toLowerCase()
    );
    if (matched && matched.password !== signInPassword) {
      setErrorMsg('Incorrect password for this account.');
      return;
    }

    const inferredName = signInEmail.split('@')[0].replace(/[._-]/g, ' ');
    const displayName =
      matched?.name ||
      profile.name ||
      inferredName.charAt(0).toUpperCase() + inferredName.slice(1);

    const nextProfile: EducationProfile = {
      ...profile,
      mode: 'signed-in',
      guestConfirmed: false,
      name: displayName,
      email: signInEmail.trim(),
      age: matched?.age || profile.age,
      country: matched?.country || country,
      curriculum: matched?.curriculum || curriculum,
      educationLevel: matched?.educationLevel || educationLevel,
      grade: matched?.grade || grade,
      universityYear: matched?.universityYear || universityYear,
      subjects: matched?.subjects || selectedSubjects,
      setupCompleted: true,
    };

    onSaveProfile(nextProfile);
    setTab('profile');
    setStatusMsg('Signed in! Your study progress is now saved to this account.');
  };

  const handleCreateAccount = () => {
    setErrorMsg(null);
    const err = validateCreateAccount({
      name,
      email,
      age,
      password,
      confirmPassword,
    });
    if (err) {
      setErrorMsg(err);
      return;
    }

    const effectiveGrade = isHigherEd
      ? `${universityYear}${grade.trim() ? ` · ${grade.trim()}` : ''}`
      : grade.trim() || getDefaultGradeForLevel(educationLevel);

    saveUserAccount({
      name: name.trim(),
      email: email.trim(),
      age: age.trim(),
      password,
      country,
      curriculum,
      educationLevel,
      grade: effectiveGrade,
      universityYear: isHigherEd ? universityYear : undefined,
      subjects: selectedSubjects,
    });

    onSaveProfile({
      ...profile,
      mode: 'signed-in',
      guestConfirmed: false,
      name: name.trim(),
      email: email.trim(),
      age: age.trim(),
      country,
      curriculum,
      educationLevel,
      grade: effectiveGrade,
      universityYear: isHigherEd ? universityYear : undefined,
      subjects: selectedSubjects,
      setupCompleted: true,
    });
    setTab('education');
  };

  const handleContinueEducation = () => {
    setErrorMsg(null);
    const levelDetail = isHigherEd ? universityYear : grade.trim();
    if (!country || !curriculum || !educationLevel || !levelDetail) {
      setErrorMsg('Please complete your country, curriculum, level, and grade or university year.');
      return;
    }
    setTab('subjects');
  };

  const handleSaveSubjects = () => {
    setErrorMsg(null);
    const effectiveGrade = isHigherEd
      ? `${universityYear}${grade.trim() ? ` · ${grade.trim()}` : ''}`
      : grade.trim();

    const err = validateEducationSetup({
      country,
      curriculum,
      educationLevel,
      grade: effectiveGrade,
      subjects: selectedSubjects,
    });
    if (err) {
      setErrorMsg(err);
      return;
    }

    const updatedProfile: EducationProfile = {
      ...profile,
      guestConfirmed: profile.mode === 'guest' ? true : false,
      country,
      curriculum,
      educationLevel,
      grade: effectiveGrade,
      universityYear: isHigherEd ? universityYear : undefined,
      subjects: selectedSubjects,
      setupCompleted: true,
    };

    if (profile.mode === 'signed-in' && profile.email) {
      const existing = loadUsers().find(
        (u) => u.email.toLowerCase() === profile.email.toLowerCase()
      );
      if (existing) {
        saveUserAccount({
          ...existing,
          country,
          curriculum,
          educationLevel,
          grade: effectiveGrade,
          universityYear: isHigherEd ? universityYear : undefined,
          subjects: selectedSubjects,
        });
      }
    }

    onSaveProfile(updatedProfile);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Account and Education Setup"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[var(--alexyn-border)] bg-[#081129] p-5 text-slate-100 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex items-center justify-between border-b border-[var(--alexyn-border)] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#132550] text-[#38BDF8]">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {tab === 'choice' && 'Your ALEXYN Account'}
                {tab === 'guest-status' && 'Signed in as Guest'}
                {tab === 'profile' && `Welcome, ${profile.name || 'Learner'}`}
                {tab === 'signin' && 'Sign In'}
                {tab === 'create' && 'Create Account'}
                {tab === 'education' && 'Your Education & Curriculum'}
                {tab === 'subjects' && 'Select Subjects & Languages'}
              </h2>
              <p className="text-xs text-slate-400">
                {profile.mode === 'signed-in' && profile.name
                  ? `${profile.email} · Progress Saved ✓`
                  : profile.guestConfirmed
                  ? `Guest mode · ${profile.curriculum || 'Personal workspace'}`
                  : 'Choose Guest or Sign in to save progress'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-[#122249] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {statusMsg && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMsg}
          </div>
        )}

        {tab === 'guest-status' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">
              <p className="font-bold text-amber-200">Reminder: You are currently signed in as Guest</p>
              <p className="mt-1">
                Guest mode lets you explore everything freely, but your subject progress is only saved permanently once you create an account or sign in.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0C1634] p-4 text-sm">
              <p className="text-xs font-semibold text-[#7DD3FC]">Current Guest Learning Setup</p>
              <p className="mt-1 font-bold text-white">
                {profile.country} · {profile.curriculum}
              </p>
              <p className="mt-0.5 text-xs text-slate-300">
                {profile.educationLevel} · {profile.grade}
              </p>
            </div>

            {onOpenProgress && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProgress();
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-[#2E8BFF]/40 bg-[#0D1E45] px-4 py-3 text-left transition-colors hover:border-[#38BDF8] hover:bg-[#132960]"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="h-4 w-4 text-[#5EEAD4]" />
                  <div>
                    <p className="text-sm font-bold text-white">My Progress & Analytics</p>
                    <p className="text-[11px] text-slate-300">
                      {progressSummary && progressSummary.totalAttempts > 0
                        ? `${progressSummary.overallAverage}% avg · ${progressSummary.totalAttempts} graded quiz${progressSummary.totalAttempts === 1 ? '' : 'zes'}`
                        : 'Quiz marks, multi-color trends & smart study reminders'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#7DD3FC]">Open →</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setTab('education')}
              className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0F1C3D] px-4 py-3 text-sm font-semibold text-white hover:border-[#38BDF8]"
            >
              Change Country, Level, Class or Subjects
            </button>

            <button
              type="button"
              onClick={handleLeaveGuest}
              className="w-full rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-3.5 text-sm font-bold text-white"
            >
              Leave Guest Mode · Sign In or Create Account →
            </button>
          </div>
        )}

        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm font-bold">Account Active · Study Progress Saved</span>
              </div>
              <p className="mt-1 text-xs text-slate-200">
                {profile.name} ({profile.email})
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0C1634] p-4 text-sm">
              <p className="text-xs font-semibold text-[#7DD3FC]">Education Setup</p>
              <p className="mt-1 font-bold text-white">
                {profile.country} · {profile.curriculum}
              </p>
              <p className="mt-0.5 text-xs text-slate-300">
                {profile.educationLevel} · {profile.grade}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Subjects: {profile.subjects.join(', ')}
              </p>
            </div>

            {onOpenProgress && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProgress();
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-[#2E8BFF]/40 bg-[#0D1E45] px-4 py-3 text-left transition-colors hover:border-[#38BDF8] hover:bg-[#132960]"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="h-4 w-4 text-[#5EEAD4]" />
                  <div>
                    <p className="text-sm font-bold text-white">My Progress & Analytics</p>
                    <p className="text-[11px] text-slate-300">
                      {progressSummary && progressSummary.totalAttempts > 0
                        ? `${progressSummary.overallAverage}% avg · ${progressSummary.totalAttempts} graded quiz${progressSummary.totalAttempts === 1 ? '' : 'zes'}`
                        : 'Quiz marks, multi-color trends & smart study reminders'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#7DD3FC]">Open →</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setTab('education')}
              className="w-full rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-3 text-sm font-bold text-white"
            >
              Edit Class, Curriculum or Subjects
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTab('choice')}
                className="rounded-xl border border-[var(--alexyn-border)] bg-[#0F1C3D] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:text-white"
              >
                Switch Account
              </button>
              <button
                type="button"
                onClick={() => {
                  onLogOutAccount();
                  setTab('choice');
                  setStatusMsg('Logged out cleanly.');
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}

        {tab === 'choice' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Sign in or create an account to save your study progress permanently, or continue as a Guest.
            </p>

            <button
              type="button"
              onClick={handleUseGuest}
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--alexyn-border)] bg-[#0E1B3D] p-4 text-left transition-colors hover:border-[#2E8BFF]/60 hover:bg-[#132450]"
            >
              <div>
                <p className="font-semibold text-white">Continue as Guest</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Instant access without saving across sessions
                </p>
              </div>
              <UserCheck className="h-5 w-5 text-[#5EEAD4]" />
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setTab('signin');
              }}
              className="w-full rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-95"
            >
              Sign in to ALEXYN
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setTab('create');
              }}
              className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0F1C3D] px-4 py-3.5 text-sm font-semibold text-slate-100 hover:bg-[#162752]"
            >
              Create new account
            </button>

            {onOpenProgress && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProgress();
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-[#2E8BFF]/40 bg-[#0D1E45] px-4 py-3 text-left transition-colors hover:border-[#38BDF8] hover:bg-[#132960]"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="h-4 w-4 text-[#5EEAD4]" />
                  <div>
                    <p className="text-sm font-bold text-white">My Progress & Analytics</p>
                    <p className="text-[11px] text-slate-300">
                      {progressSummary && progressSummary.totalAttempts > 0
                        ? `${progressSummary.overallAverage}% avg · ${progressSummary.totalAttempts} graded quiz${progressSummary.totalAttempts === 1 ? '' : 'zes'}`
                        : 'Quiz marks, subject trends & smart study reminders'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#7DD3FC]">Open →</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setTab('education');
              }}
              className="w-full rounded-xl px-4 py-2.5 text-center text-xs font-medium text-[#38BDF8] hover:underline"
            >
              Customize Country, Curriculum & Subjects →
            </button>
          </div>
        )}

        {tab === 'signin' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300" htmlFor="modalSignInEmail">
                Account email
              </label>
              <input
                id="modalSignInEmail"
                type="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300" htmlFor="modalSignInPassword">
                Password
              </label>
              <input
                id="modalSignInPassword"
                type="password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSignIn}
              className="w-full rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] py-3.5 text-sm font-bold text-white"
            >
              Sign In & Save Progress
            </button>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <button type="button" onClick={() => setTab('create')} className="text-[#38BDF8] hover:underline">
                Create an account instead
              </button>
              <button type="button" onClick={() => setTab('choice')} className="hover:text-white">
                ← Back
              </button>
            </div>
          </div>
        )}

        {tab === 'create' && (
          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300" htmlFor="modalCreateName">
                Full Name
              </label>
              <input
                id="modalCreateName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-300" htmlFor="modalCreateEmail">
                  Account Email
                </label>
                <input
                  id="modalCreateEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300" htmlFor="modalCreateAge">
                  Age
                </label>
                <input
                  id="modalCreateAge"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="16"
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300" htmlFor="modalCreatePass">
                  Create Password
                </label>
                <input
                  id="modalCreatePass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300" htmlFor="modalRepeatPass">
                  Repeat Password
                </label>
                <input
                  id="modalRepeatPass"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateAccount}
              className="mt-1 w-full rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] py-3.5 text-sm font-bold text-white"
            >
              Continue to Curriculum & Level →
            </button>

            <button
              type="button"
              onClick={() => setTab('choice')}
              className="block text-xs text-slate-400 hover:text-white"
            >
              ← Back to account options
            </button>
          </div>
        )}

        {tab === 'education' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Set up your learning space</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Choose any curriculum worldwide—your Class/Grade options shift automatically when you switch between Primary, Secondary, College, or University.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300" htmlFor="eduCountry">
                  <Globe2 className="h-3.5 w-3.5 text-[#38BDF8]" />
                  <span>Country / Region</span>
                </label>
                <select
                  id="eduCountry"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-3.5 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300" htmlFor="eduCurriculum">
                  <Layers className="h-3.5 w-3.5 text-[#38BDF8]" />
                  <span>Curriculum / Education System</span>
                </label>
                <select
                  id="eduCurriculum"
                  value={curriculum}
                  onChange={(e) => setCurriculum(e.target.value)}
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-3.5 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  {CURRICULA.map((cur) => (
                    <option key={cur} value={cur}>
                      {cur}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300" htmlFor="eduLevel">
                  <GraduationCap className="h-3.5 w-3.5 text-[#38BDF8]" />
                  <span>Education Level</span>
                </label>
                <select
                  id="eduLevel"
                  value={educationLevel}
                  onChange={(e) =>
                    handleEducationLevelChange(
                      e.target.value as EducationProfile['educationLevel']
                    )
                  }
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-3.5 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  {EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              {isHigherEd ? (
                <>
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300" htmlFor="eduUniYear">
                      <Star className="h-3.5 w-3.5 text-[#5EEAD4]" />
                      <span>
                        {educationLevel === 'College' ? 'College Program & Year' : 'University Year'}
                      </span>
                    </label>
                    <select
                      id="eduUniYear"
                      value={universityYear}
                      onChange={(e) => setUniversityYear(e.target.value)}
                      className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-3.5 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
                    >
                      {gradeOptions.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300" htmlFor="eduGrade">
                      <Star className="h-3.5 w-3.5 text-[#38BDF8]" />
                      <span>Degree / Course / Major (Optional)</span>
                    </label>
                    <input
                      id="eduGrade"
                      type="text"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="e.g. Computer Science, Nursing, Engineering"
                      className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-3.5 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300" htmlFor="eduGradeSelect">
                    <Star className="h-3.5 w-3.5 text-[#38BDF8]" />
                    <span>
                      {educationLevel === 'Primary' ? 'Primary Grade / Standard' : 'Secondary Class / Form / Grade'}
                    </span>
                  </label>
                  <select
                    id="eduGradeSelect"
                    value={gradeOptions.includes(grade) ? grade : gradeOptions[0]}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-3.5 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
                  >
                    {gradeOptions.map((gOpt) => (
                      <option key={gOpt} value={gOpt}>
                        {gOpt}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleContinueEducation}
              className="w-full rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] py-3.5 text-sm font-bold text-white"
            >
              Continue to Subjects →
            </button>
          </div>
        )}

        {tab === 'subjects' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0C1634] p-4">
              <h3 className="mb-1 text-sm font-bold text-white">
                Core Subjects (including English, Kiswahili, CSL & ICT)
              </h3>
              <p className="mb-2.5 text-[11px] text-slate-400">
                Select any subjects you study or want to explore.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CORE_SUBJECTS.map((subj) => {
                  const checked = selectedSubjects.includes(subj.name);
                  return (
                    <label
                      key={subj.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        checked
                          ? 'border-[#2E8BFF] bg-[#132656] text-white'
                          : 'border-[var(--alexyn-border)] bg-[#09122B] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSubject(subj.name)}
                        className="h-4 w-4 rounded accent-[#2E8BFF]"
                      />
                      <span>{subj.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0C1634] p-4">
              <h3 className="mb-1 text-sm font-bold text-white">
                World Languages (Separate Section)
              </h3>
              <p className="mb-2.5 text-[11px] text-slate-400">
                Japanese, Spanish, French, Chinese & more.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGE_SUBJECTS.map((lang) => {
                  const checked = selectedSubjects.includes(lang.name);
                  return (
                    <label
                      key={lang.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        checked
                          ? 'border-[#2E8BFF] bg-[#132656] text-white'
                          : 'border-[var(--alexyn-border)] bg-[#09122B] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSubject(lang.name)}
                        className="h-4 w-4 rounded accent-[#2E8BFF]"
                      />
                      <span>
                        {lang.flag} {lang.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setTab('education')}
                className="rounded-xl border border-[var(--alexyn-border)] bg-[#0F1C3D] px-4 py-3 text-sm font-semibold text-slate-200"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleSaveSubjects}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] py-3 text-sm font-bold text-white"
              >
                <Check className="h-4 w-4" />
                <span>Save Subjects</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
