

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Users, Video, TrendingUp, Check, ChevronRight, Sparkles } from 'lucide-react';
import Dashboard from './Dashboard';
import { User } from '../types';

interface OnboardingProps {
  onComplete: () => void;
}

const MOCK_DEMO_USER: User = {
  id: 'onboarding-demo',
  kovaId: 'DEMO-888',
  name: 'Alex Founder',
  role: 'Founder & CEO',
  industry: 'Technology',
  bio: 'Building the future of social connection.',
  imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?fit=crop&w=200&h=200',
  tags: ['Visionary', 'Product', 'SaaS'],
  badges: [
    { id: '1', icon: '🚀', name: 'Early Adopter', color: 'text-gold', criteria: 'Join Kova' },
    { id: '2', icon: '🔥', name: '7 Day Streak', color: 'text-gold', criteria: 'Streak' },
    { id: '4', icon: '🎯', name: 'Goal Crusher', color: 'text-gold', criteria: 'Goals' }
  ],
  email: 'demo@kova.app',
  password: '',
  dob: '1995-01-01',
  age: 28,
  gender: 'Male',
  stage: 'Scaling',
  location: { city: 'San Francisco', state: 'CA' },
  mainGoal: 'Networking',
  securityQuestion: '',
  securityAnswer: ''
};

const SLIDES = [
  {
    id: 1,
    title: "Welcome to Kova",
    subtitle: "Connect. Collaborate. Grow.",
    description: "The premier social platform for entrepreneurs. Stop building in isolation and start connecting with founders who match your ambition.",
    icon: <Users className="w-12 h-12 text-white" />,
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1000&auto=format&fit=crop",
    color: "from-primary to-secondary"
  },
  {
    id: 2,
    title: "Smart Matching",
    subtitle: "Curated Connections",
    description: "Our algorithm pairs you with co-founders, mentors, and peers based on your industry, stage, and goals. Swipe right to build your network.",
    icon: <Sparkles className="w-12 h-12 text-white" />,
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1000&auto=format&fit=crop",
    color: "from-purple-600 to-blue-500"
  },
  {
    id: 3,
    title: "Live Co-working",
    subtitle: "Deep Work Sessions",
    description: "Jump into video rooms with shared tools like goal checklists and collaborative notes. It's accountability reimagined for the digital age.",
    icon: <Video className="w-12 h-12 text-white" />,
    image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1000&auto=format&fit=crop",
    color: "from-blue-600 to-teal-400"
  },
  {
    id: 4,
    title: "Gamify Your Success",
    subtitle: "Track & Achieve",
    description: "Earn badges, maintain activity streaks, and visualize your consistency. We turn the grind into a game you want to win.",
    icon: <TrendingUp className="w-12 h-12 text-white" />,
    useDashboard: true,
    color: "from-gold to-orange-500"
  }
];

const OnboardingWalkthrough: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleDotClick = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8
    })
  };

  const currentSlide = SLIDES[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-background text-white overflow-hidden flex flex-col">
      {/* Dynamic Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
         <div className={`absolute inset-0 bg-gradient-to-br ${currentSlide.color} transition-all duration-1000`} />
         <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-white/10 rounded-full blur-[120px] animate-pulse" />
         <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] bg-white/10 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      {/* Skip Button */}
      <div className="absolute top-8 right-8 z-50">
        <button 
          onClick={onComplete}
          className="text-sm font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors px-4 py-2 hover:bg-white/10 rounded-full"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-6">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="w-full max-w-md flex flex-col items-center text-center z-10"
          >
            {/* Hero Image Circle */}
            <div className="relative mb-12 group">
               <div className={`absolute inset-0 bg-gradient-to-r ${currentSlide.color} rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-500`} />
               <div className="relative w-72 h-72 rounded-full overflow-hidden border-[6px] border-white/10 shadow-2xl bg-surface">
                  {/* Render Image OR Dashboard */}
                  {currentSlide.useDashboard ? (
                    <div className="w-[800px] h-[800px] absolute top-0 left-0 origin-top-left transform scale-[0.36] bg-background">
                      {/* The Dashboard Component */}
                      <Dashboard user={MOCK_DEMO_USER} />
                      {/* Invisible overlay to catch clicks/scrolling within the mini view */}
                      <div className="absolute inset-0 z-50 bg-transparent" />
                    </div>
                  ) : (
                    <img 
                      src={currentSlide.image} 
                      alt={currentSlide.title} 
                      className="w-full h-full object-cover transform scale-110 group-hover:scale-100 transition-transform duration-700"
                    />
                  )}

                  <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                  
                  {/* Icon Badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="p-5 bg-white/10 rounded-3xl backdrop-blur-md border border-white/20 shadow-2xl transform translate-y-20 group-hover:translate-y-0 transition-transform duration-500">
                        {currentSlide.icon}
                     </div>
                  </div>
               </div>
            </div>

            {/* Text Content */}
            <motion.div
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.2 }}
               className="px-4"
            >
              <div className={`inline-block px-3 py-1 rounded-full bg-gradient-to-r ${currentSlide.color} bg-opacity-10 border border-white/10 mb-4`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white">
                  {currentSlide.subtitle}
                </p>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-white">
                {currentSlide.title}
              </h1>
              <p className="text-white/70 text-lg leading-relaxed max-w-sm mx-auto font-light">
                {currentSlide.description}
              </p>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="h-32 flex flex-col items-center justify-end pb-10 px-8 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
         {/* Pagination Dots */}
         <div className="flex gap-3 mb-8">
           {SLIDES.map((_, idx) => (
             <button
               key={idx}
               onClick={() => handleDotClick(idx)}
               className={`h-2 rounded-full transition-all duration-500 ${idx === currentIndex ? `w-8 bg-white` : 'w-2 bg-white/20 hover:bg-white/40'}`}
             />
           ))}
         </div>

         {/* Primary Action Button */}
         <button
           onClick={handleNext}
           className={`w-full max-w-sm py-4 rounded-2xl font-bold text-white shadow-[0_0_30px_rgba(0,0,0,0.3)] transform active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 text-lg bg-gradient-to-r ${currentSlide.color} hover:brightness-110`}
         >
           {currentIndex === SLIDES.length - 1 ? (
             <>Get Started <Check size={24} strokeWidth={3} /></>
           ) : (
             <>Next <ChevronRight size={24} strokeWidth={3} /></>
           )}
         </button>
      </div>
    </div>
  );
};

export default OnboardingWalkthrough;