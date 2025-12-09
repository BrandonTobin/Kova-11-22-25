import React from 'react';
import { ViewState } from '../types';

const PRIVACY_URL =
  'https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/legal/Kova_Privacy_Policy.pdf';
const TERMS_URL =
  'https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/legal/Kova_Terms_of_Service.pdf';
const REFUND_URL =
  'https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/legal/Kova_Refund_Policy.pdf';
const CONTACT_URL =
  'https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/legal/Kova_Contact_Info.pdf';

interface LegalFooterProps {
  className?: string;
  onNavigateLegal?: (view: ViewState) => void;
}

const LegalFooter: React.FC<LegalFooterProps> = ({
  className = '',
  onNavigateLegal,
}) => {
  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    view: ViewState
  ) => {
    if (!onNavigateLegal) {
      // No callback provided → fall back to normal link behavior (opens PDF)
      return;
    }
    e.preventDefault();
    onNavigateLegal(view);
  };

  return (
    <div
      className={`mt-8 text-[11px] md:text-xs text-text-muted flex flex-wrap items-center justify-center gap-3 md:gap-4 ${className}`}
    >
      <a
        href={PRIVACY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => handleClick(e, ViewState.PRIVACY)}
        className="hover:text-primary underline-offset-2 hover:underline"
      >
        Privacy Policy
      </a>
      <span>•</span>
      <a
        href={TERMS_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => handleClick(e, ViewState.TERMS)}
        className="hover:text-primary underline-offset-2 hover:underline"
      >
        Terms of Service
      </a>
      <span>•</span>
      <a
        href={REFUND_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => handleClick(e, ViewState.REFUND)}
        className="hover:text-primary underline-offset-2 hover:underline"
      >
        Refund Policy
      </a>
      <span>•</span>
      <a
        href={CONTACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => handleClick(e, ViewState.CONTACT)}
        className="hover:text-primary underline-offset-2 hover:underline"
      >
        Contact
      </a>
    </div>
  );
};

export default LegalFooter;