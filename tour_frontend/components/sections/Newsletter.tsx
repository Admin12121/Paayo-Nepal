import { Mail } from 'lucide-react';

export function NewsletterSection() {
  return (
    <section 
      className="py-20 px-6"
      style={{
        background: 'linear-gradient(135deg, #F29C72 0%, #D97B3B 100%)'
      }}
    >
      <div className="max-w-[800px] mx-auto text-center">
        {/* Mail icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center">
            <Mail className="w-12 h-12 text-white" strokeWidth={1.5} />
          </div>
        </div>
        
        <h2 className="font-display text-[36px] md:text-[48px] font-medium text-white mb-4 leading-tight">
          Subscribe to our newsletter for the latest updates and insights.
        </h2>
        
        <p className="text-white/80 text-base md:text-lg mb-10 max-w-xl mx-auto">
          Stay current with the latest updates, insights, and search from those migrations.
        </p>

        {/* Email input */}
        <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
          <div className="flex-1 relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="email"
              placeholder="Enter your email"
              className="w-full h-14 pl-12 pr-4 rounded-lg bg-white text-[#1E1E1E] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
          <button className="h-14 px-8 bg-[#1E1E1E] text-white font-bold rounded-lg hover:bg-[#333] transition-colors uppercase tracking-wide">
            Subscribe
          </button>
        </div>
      </div>
    </section>
  );
}
