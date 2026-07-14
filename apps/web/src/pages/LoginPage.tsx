import React, { useState } from 'react';
import { TestTube, Phone, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/authStore';
import { ROLE_LABELS, type UserRole } from '../types';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login, availableContexts, selectContext } = useAuthStore();
  const [step, setStep] = useState<'login' | 'context'>('login');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ phone?: string; password?: string; general?: string }>({});
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

  const handleSelectContext = (applicationId: string, role: UserRole) => {
    selectContext(applicationId, role);
    onSuccess();
  };

  if (step === 'context') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
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
              {availableContexts.map((ctx, index) => (
                <button
                  key={`${ctx.application.id}-${ctx.role}-${index}`}
                  onClick={() => handleSelectContext(ctx.application.id, ctx.role)}
                  className="w-full p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-right transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    <div>
                      <p className="font-semibold text-gray-900">{ctx.application.name}</p>
                      <p className="text-sm text-blue-600 mt-0.5">{ROLE_LABELS[ctx.role]}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
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
                  />
                </div>
                {errors.phone && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
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
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors(prev => {
                        const { password: _password, ...rest } = prev;
                        return rest;
                      });
                    }}
                    placeholder="رمز عبور خود را وارد کنید"
                    className={`w-full pr-10 pl-4 py-3 border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    autoComplete="current-password"
                  />
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <span>⚠</span> {errors.password}
                  </p>
                )}
              </div>

              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
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
              <p className="text-xs text-gray-400 mt-2">رمز عبور: هر مقداری</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer on login page */}
      <footer className="py-4 text-center">
        <p className="text-xs text-gray-400">
          کلیه حقوق مادی و معنوی این سامانه متعلق به رستانوین رایا می‌باشد.
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          طراحی، تولید و توسعه توسط مریم حسنی کلهری | نسخه ۰.۱.۰
        </p>
      </footer>
    </div>
  );
};
