import { motion } from 'framer-motion'

type MascotZone = 'no-data' | 'low' | 'in-range' | 'high'

interface GlucoseMascotProps {
  zone: MascotZone
  streak: number
  showCrown: boolean
}

const PANDA = '🐼'
const TURTLE = '🐢'
const CAT = '🐱'
const SLEEPING = '😴'
const CROWN = '👑'

export default function GlucoseMascot({ zone, streak, showCrown }: GlucoseMascotProps) {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="relative">
        {showCrown && (
          <motion.span
            className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xl"
            initial={{ y: -4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {CROWN}
          </motion.span>
        )}

        {zone === 'no-data' && (
          <motion.span
            className="text-5xl select-none"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {SLEEPING}
          </motion.span>
        )}

        {zone === 'in-range' && (
          <motion.span
            className="text-5xl select-none"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {PANDA}
          </motion.span>
        )}

        {zone === 'low' && (
          <motion.span
            className="text-5xl select-none"
            animate={{ scale: [1, 0.92, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            {TURTLE}
          </motion.span>
        )}

        {zone === 'high' && (
          <motion.span
            className="text-5xl select-none"
            animate={{ rotate: [-6, 6, -6] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            {CAT}
          </motion.span>
        )}
      </div>

      {zone === 'low' && (
        <p className="text-sm font-medium" style={{ color: 'var(--color-glucose-low)' }}>
          Mange quelque chose ! 🍬
        </p>
      )}

      {zone === 'high' && (
        <p className="text-sm font-medium" style={{ color: 'var(--color-glucose-high)' }}>
          Bois de l'eau ! 💧
        </p>
      )}

      {streak > 0 && (
        <p className="text-xs font-semibold" style={{ color: 'var(--color-glucose-in-range)' }}>
          🔥 {streak} jour{streak > 1 ? 's' : ''} dans la cible
        </p>
      )}
    </div>
  )
}
