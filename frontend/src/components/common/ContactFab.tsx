import { useState } from "react";
import { Phone, MessageCircle, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

interface ContactFabProps {
  /** Local number for the "tel:" link, shown as-is (e.g. "01624114405"). */
  phoneDisplay: string;
  /** International number for the WhatsApp "wa.me" link — no "+", no leading 0 (e.g. "8801624114405"). */
  phoneIntl: string;
}

/**
 * Floating "Call / WhatsApp" action button, fixed to the bottom-right of the
 * viewport. Pulses gently to draw the eye while closed; tapping it reveals
 * the two contact options with a staggered pop-in.
 */
export default function ContactFab({ phoneDisplay, phoneIntl }: ContactFabProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-8 right-3 lg:bottom-20 lg:right-24 z-50 flex flex-col items-end gap-3">
      {/* Call / WhatsApp options — staggered pop-in when open */}
      <div className="flex flex-col items-end gap-3">
        <a
          href={`https://wa.me/${phoneIntl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2.5 rounded-full bg-[#25D366] py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition-all duration-300 ease-out hover:brightness-95 ${
            open
              ? "translate-y-0 scale-100 opacity-100 delay-100"
              : "pointer-events-none translate-y-3 scale-75 opacity-0"
          }`}
        >
          <FaWhatsapp size={20} />
          WhatsApp
        </a>
        <a
          href={`tel:${phoneDisplay}`}
          className={`flex items-center gap-2.5 rounded-full bg-emerald-600 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition-all duration-300 ease-out hover:bg-emerald-700 ${
            open
              ? "translate-y-0 scale-100 opacity-100 delay-0"
              : "pointer-events-none translate-y-3 scale-75 opacity-0"
          }`}
        >
          <Phone size={18} />
          কল করুন
        </a>
      </div>

      {/* Toggle button */}
      <div className="relative">
        {/* Attention-grabbing pulse ring — only while closed, so it doesn't
            distract once the person has already found the options. */}
        {!open && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-500 opacity-75" />
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "যোগাযোগ অপশন বন্ধ করুন" : "যোগাযোগ করুন"}
          aria-expanded={open}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-transform duration-300 hover:scale-105 hover:bg-emerald-700 active:scale-95"
        >
          <span
            className={`flex transition-transform duration-300 ${open ? "rotate-90" : "rotate-0"}`}
          >
            {open ? <X size={24} /> : <MessageCircle size={24} />}
          </span>
        </button>
      </div>
    </div>
  );
}
