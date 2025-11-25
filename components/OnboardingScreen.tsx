import React, { useState } from 'react';
import { Crown, Activity, Users, ArrowRight, Check, Sparkles } from 'lucide-react';

interface OnboardingScreenProps {
  onFinish: () => void;
}

const ONBOARDING_STEPS = [
  {
    title: "Premium Network",
    subtitle: "Kova is a premium network for entrepreneurs.",
    icon: Crown,
    bullets: [
      "Connect with serious founders and operators",
      "Meet people who are actively building and shipping",
      "Zero fluff, just focused conversations"
    ]
  },
  {
    title: "Investors & Discovery",
    subtitle: "Investors are also welcome and can use it to discover founders.",
    icon: Activity,
    bullets: [
      "Find high-potential startups early",
      "See what founders are building before it hits the mainstream",
      "Connect directly with founders"
    ]
  },
  {
    title: "Intelligent Matching",
    subtitle: "Kova helps match people based on goals, experience level, and working style.",
    icon: Users,
    bullets: [
      "AI-driven compatibility scores",
      "Find your perfect co-founder or partner",
      "Collaborate in dedicated video rooms"
    ]
  }
];

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onFinish }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const stepData = ONBOARDING_STEPS[currentStep];
  const Icon = stepData.icon;

  return (
    <div className="h-screen w-full bg-background flex flex-col relative overflow-hidden text-text-main">
       {/* Background Effects */}
       <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[50%] -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-80 h-80 bg-gold/5 rounded-full blur-[100px]" />
      </div>

      {/* Top Bar: Skip */}
      <div className="w-full p-6 flex justify-end z-20 shrink-0">
        <button
          onClick={onFinish}
          className="text-text-muted hover:text-white text-sm font-medium transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 z-10 max-w-md mx-auto w-full -mt-16">

        {/* Icon Circle */}
        <div className="mb-8 relative animate-in fade-in zoom-in duration-500">
           <div className="absolute inset-0 bg-gold/20 rounded-full blur-xl animate-pulse"></div>
           <div className="relative w-24 h-24 bg-surface rounded-full border border-gold/30 flex items-center justify-center shadow-2xl">
              <Icon size={40} className="text-gold" />
           </div>
        </div>

        {/* Text */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 key-{currentStep}">
          <h1 className="text-3xl font-bold mb-3 tracking-tight text-text-main">{stepData.title}</h1>
          <p className="text-text-muted text-lg font-light leading-relaxed px-2">{stepData.subtitle}</p>
        </div>

        {/* Bullets */}
        <div className="w-full space-y-4">
          {stepData.bullets.map((bullet, idx) => (
            <div 
              key={`${currentStep}-${idx}`} 
              className="flex items-center gap-4 bg-surface/50 border border-white/5 p-4 rounded-xl animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards" 
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center shrink-0 border border-gold/20">
                <Check size={14} className="text-gold" />
              </div>
              <p className="text-sm font-medium text-text-main/90">{bullet}</p>
            </div>
          ))}
        </div>

        {/* Navigation Area - Moved up closer to content (removed mt-auto and pb-16) */}
        <div className="w-full mt-10">
           {/* Buttons - Positioned above dots */}
           <div className="flex gap-4 mb-6">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="px-6 py-4 rounded-xl border border-white/10 text-text-muted font-bold hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-bold shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 group border border-white/5"
              >
                {currentStep === ONBOARDING_STEPS.length - 1 ? 'Continue to Kova' : 'Next'}
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
           </div>

           {/* Progress Dots */}
           <div className="flex justify-center gap-2">
             {ONBOARDING_STEPS.map((_, idx) => (
               <div
                 key={idx}
                 className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-8 bg-gold' : 'w-2 bg-white/20'}`}
               />
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;