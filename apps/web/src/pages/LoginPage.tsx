import React, { useState } from 'react';
import { TestTube, Phone, Lock, ArrowLeft, Eye, EyeOff, Mail, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { userApi } from '../services/api';
import { getContextApplicationLabel, useAuthStore } from '../stores/authStore';
import { toast } from '../components/ui/Toast';
import { ROLE_LABELS } from '../types';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login, availableContexts, switchContext } = useAuthStore();
  const [step, setStep] = useState<'login' | 'context' | 'forgot-request' | 'forgot-reset'>('login');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; password?: string; general?: string }>({});
  const [resetPhone, setResetPhone] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetMaskedEmail, setResetMaskedEmail] = useState('');
  const [resetOtpPreview, setResetOtpPreview] = useState('');
  const [resetError, setResetError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { phone?: string; password?: string } = {};
    
    if (!phoneNumber.trim()) {
      newErrors.phone = 'وارد کردن شماره تلفن الزامی است.';
    } else if (!/^09\d{9}$/.test(phoneNumber.trim())) {
      newErrors.phone = 'شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود. مثال: ۰۹۱۲۱۲۳۴۵۶۷';
    }
    
    if (!password.trim()) {
      newErrors.password = 'وارد کردن رمز عبور الزامی است.';
    } else if (password.length < 3) {
      newErrors.password = 'رمز عبور باید حداقل ۳ کاراکتر باشد.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      const success = await login(phoneNumber.trim(), password);
      if (success) {
        setStep('context');
      } else {
        setErrors({ general: 'شماره تلفن یا رمز عبور اشتباه است. لطفاً مجدداً تلاش کنید.' });
      }
    } catch {
      setErrors({ general: 'خطا در برقراری ارتباط با سرور. لطفاً مجدداً تلاش کنید.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContext = (contextId: string) => {
    if (switchContext(contextId)) {
      onSuccess();
      return;
    }
    setErrors({ general: 'این دسترسی دیگر فعال نیست. لطفاً دوباره وارد شوید.' });
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPhone = resetPhone.trim();
    setResetError('');
    if (!/^09\d{9}$/.test(trimmedPhone)) {
      setResetError('شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود.');
      return;
    }
    setLoading(true);
    try {
      const result = await userApi.requestPasswordResetOtp(trimmedPhone);
      if (!result) {
        setResetError('کاربر فعالی با این شماره تلفن پیدا نشد.');
        return;
      }
      setResetMaskedEmail(result.maskedEmail);
      setResetOtpPreview(result.otpCode);
      setStep('forgot-reset');
      toast.success(`کد یک‌بارمصرف برای ${result.maskedEmail} آماده شد.`);
    } catch {
      setResetError('خطا در ارسال کد بازیابی رمز.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (!/^\d{6}$/.test(resetOtp.trim())) {
      setResetError('کد OTP باید ۶ رقم باشد.');
      return;
    }
    if (resetPassword.length < 6) {
      setResetError('رمز جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      setResetError('تکرار رمز عبور با رمز جدید یکسان نیست.');
      return;
    }
    setLoading(true);
    try {
      const success = await userApi.resetPasswordWithOtp(resetPhone.trim(), resetOtp.trim(), resetPassword);
      if (!success) {
        setResetError('کد OTP معتبر نیست یا منقضی شده است.');
        return;
      }
      setPhoneNumber(resetPhone.trim());
      setPassword(resetPassword);
      setResetOtp('');
      setResetPassword('');
      setResetPasswordConfirm('');
      setResetOtpPreview('');
      setStep('login');
      toast.success('رمز عبور جدید ثبت شد. حالا می‌توانید وارد شوید.');
    } catch {
      setResetError('خطا در ثبت رمز جدید.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'context') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4 pt-20 sm:p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TestTube className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">انتخاب محیط کاری</h1>
              <p className="text-gray-500 text-sm">سامانه و نقش مورد نظر خود را انتخاب کنید</p>
            </div>

            <div className="space-y-3">
              {availableContexts.map(ctx => (
                <button
                  key={ctx.contextId}
                  onClick={() => handleSelectContext(ctx.contextId)}
                  className="w-full p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-right transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    <div>
                      <p className="font-semibold text-gray-900">{ROLE_LABELS[ctx.role]}</p>
                      <p className="mt-1 text-sm leading-6 text-gray-600">{getContextApplicationLabel(ctx)}</p>
                    </div>
                  </div>
                </button>
              ))}
              {availableContexts.length === 0 && (
                <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  نقش یا دسترسی فعالی برای این کاربر ثبت نشده است. با مدیر سیستم تماس بگیرید.
                </div>
              )}
            </div>

            {errors.general && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {errors.general}
              </div>
            )}

            <button
              onClick={() => setStep('login')}
              className="w-full mt-6 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              بازگشت به صفحه ورود
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'forgot-request' || step === 'forgot-reset') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4 pt-20 sm:p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                {step === 'forgot-request' ? <Mail className="w-8 h-8 text-white" /> : <KeyRound className="w-8 h-8 text-white" />}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">بازیابی رمز عبور</h1>
              <p className="text-gray-500 text-sm">
                {step === 'forgot-request' ? 'شماره تلفن حساب کاربری را وارد کنید' : `کد ارسال‌شده به ${resetMaskedEmail} را وارد کنید`}
              </p>
            </div>

            {step === 'forgot-request' ? (
              <form onSubmit={handleRequestPasswordReset} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="reset-phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                    شماره تلفن <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="reset-phone"
                      type="tel"
                      value={resetPhone}
                      onChange={(e) => setResetPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                      className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left"
                      dir="ltr"
                      autoComplete="tel"
                      maxLength={11}
                    />
                  </div>
                </div>
                {resetError && (
                  <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {resetError}
                  </div>
                )}
                <Button type="submit" className="w-full py-3" loading={loading} disabled={loading}>
                  ارسال کد OTP
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  کد تست: <span className="font-mono" dir="ltr">{resetOtpPreview}</span>
                </div>
                <div>
                  <label htmlFor="reset-otp" className="block text-sm font-medium text-gray-700 mb-1.5">
                    کد OTP <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reset-otp"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-mono tracking-widest"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                  />
                </div>
                <div>
                  <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    رمز جدید <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="reset-password"
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="w-full pr-10 pl-11 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoComplete="new-password"
                      placeholder="رمز جدید را وارد کنید"
                    />
                    <button
                      type="button"
                      aria-label={showResetPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                      onClick={() => setShowResetPassword(prev => !prev)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showResetPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-gray-700 mb-1.5">
                    تکرار رمز جدید <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reset-password-confirm"
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetPasswordConfirm}
                    onChange={(e) => setResetPasswordConfirm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoComplete="new-password"
                    placeholder="رمز جدید را تکرار کنید"
                  />
                </div>
                {resetError && (
                  <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {resetError}
                  </div>
                )}
                <Button type="submit" className="w-full py-3" loading={loading} disabled={loading}>
                  ثبت رمز جدید
                </Button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setResetError('');
                setStep('login');
              }}
              className="w-full mt-6 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              بازگشت به صفحه ورود
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 pt-20 sm:p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TestTube className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">سامانه UTMS</h1>
              <p className="text-gray-500 text-sm">مدیریت یکپارچه کیفیت، تست و انتشار</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  شماره تلفن <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (errors.phone) setErrors(prev => {
                        const { phone: _phone, ...rest } = prev;
                        return rest;
                      });
                    }}
                    placeholder="شماره تلفن همراه خود را وارد کنید"
                    className={`w-full pr-10 pl-4 py-3 border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left`}
                    dir="ltr"
                    autoComplete="tel"
                    maxLength={11}
                    aria-invalid={errors.phone ? true : undefined}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                  />
                </div>
                {errors.phone && (
                  <p id="phone-error" role="alert" className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <span>⚠</span> {errors.phone}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  رمز عبور <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors(prev => {
                        const { password: _password, ...rest } = prev;
                        return rest;
                      });
                    }}
                    placeholder="رمز عبور خود را وارد کنید"
                    className={`w-full pr-10 pl-11 py-3 border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    autoComplete="current-password"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" role="alert" className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <span>⚠</span> {errors.password}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setResetPhone(phoneNumber);
                    setResetError('');
                    setStep('forgot-request');
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  فراموشی رمز عبور
                </button>
              </div>

              {errors.general && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {errors.general}
                </div>
              )}

              <Button
                type="submit"
                className="w-full py-3"
                loading={loading}
                disabled={loading}
              >
                ورود به سیستم
              </Button>
            </form>

            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-2 font-medium">کاربران تست:</p>
              <div className="space-y-1 text-xs text-gray-600">
                <p>توسعه‌دهنده: <span className="font-mono text-gray-800">09121234567</span></p>
                <p>سرپرست QA: <span className="font-mono text-gray-800">09122345678</span></p>
                <p>متخصص QA: <span className="font-mono text-gray-800">09123456789</span></p>
                <p>تحلیلگر: <span className="font-mono text-gray-800">09124567890</span></p>
                <p>بازبین امنیت: <span className="font-mono text-gray-800">09125678901</span></p>
                <p>سرپرست فنی: <span className="font-mono text-gray-800">09126789012</span></p>
                <p>مدیر سیستم: <span className="font-mono text-gray-800">09120000000</span></p>
              </div>
              <p className="text-xs text-gray-600 mt-2">رمز پیش‌فرض همه کاربران تست: <span className="font-mono text-gray-800" dir="ltr">123456</span></p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer on login page */}
      <footer className="py-4 text-center">
        <p className="text-xs text-gray-600">
          کلیه حقوق مادی و معنوی این سامانه متعلق به رستانوین رایا می‌باشد.
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          طراحی، تولید و توسعه توسط مریم حسنی کلهری | نسخه ۰.۱.۰
        </p>
      </footer>
    </div>
  );
};
