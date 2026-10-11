export const whatsappContactUrl = `https://wa.me/221773615944?text=${encodeURIComponent("Bonjour, je souhaite une démonstration de MenuLive pour mon restaurant.")}`;

export function WhatsAppIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a9 9 0 0 1-13.3 8L3 21l1.5-4.7A9 9 0 1 1 21 11.5Z" />
    <path d="m8.2 7.5 1.5 2.7-1 1.1a9 9 0 0 0 4 4l1.1-1 2.7 1.5c-.2 1.3-1.2 1.9-2.3 1.6-4-1-7-4-8-8-.3-1.1.3-2.1 1.6-2.3Z" />
  </svg>;
}

export default function WhatsAppContact() {
  return <a href={whatsappContactUrl} target="_blank" rel="noopener noreferrer" aria-label="Contactez MenuLive sur WhatsApp" className="fixed bottom-[20px] right-[20px] z-50 inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-[#0F5132] p-3 text-white shadow-md transition-colors hover:bg-[#123F2C] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0F5132] sm:px-5">
    <WhatsAppIcon className="h-6 w-6" />
    <span className="hidden text-sm font-medium sm:inline">Contactez-nous</span>
  </a>;
}
