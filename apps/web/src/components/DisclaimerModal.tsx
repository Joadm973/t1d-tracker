import { useUIStore } from '@/stores/ui'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

const DISCLAIMER =
  "Cette application est un outil de suivi personnel uniquement. Elle n'est pas un dispositif médical et ne remplace pas les conseils de votre équipe soignante. Ne l'utilisez pas pour prendre des décisions de traitement en cas d'hypoglycémie sévère ou d'urgence médicale."

export default function DisclaimerModal() {
  const { showDisclaimer, setShowDisclaimer } = useUIStore()

  return (
    <AnimatePresence>
      {showDisclaimer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FFF3CD', color: '#856404' }}
              >
                <AlertTriangle size={20} />
              </div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                Information importante
              </h2>
            </div>

            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
              {DISCLAIMER}
            </p>

            <button
              onClick={() => setShowDisclaimer(false)}
              className="w-full py-3 rounded-xl text-sm font-semibold min-h-[44px]"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
            >
              J'ai compris
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
