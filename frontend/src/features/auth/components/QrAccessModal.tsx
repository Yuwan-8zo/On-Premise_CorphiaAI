import { motion, AnimatePresence } from '@/lib/gsapMotion'

interface QrAccessModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function QrAccessModal({ isOpen, onClose }: QrAccessModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="qr-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md"
                    onClick={onClose}
                />
            )}
            {isOpen && (
                <motion.div
                    key="qr-modal"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                >
                    <div
                        onClick={(event) => event.stopPropagation()}
                        className="bg-bg-base p-6 rounded-[32px] shadow-2xl flex flex-col items-center pointer-events-auto"
                    >
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=0&data=${encodeURIComponent(window.location.origin)}`}
                            alt="Mobile Access QR Code"
                            className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-[16px]"
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
