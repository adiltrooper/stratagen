'use client';

import { motion } from 'motion/react';

const lineAnimation = {
    hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
    shown: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

// Two stacked lines that rise in one after the other, with "flex." in the route orange
export default function Headline() {
    return (
        <motion.h1
            className="flex flex-col items-center text-center text-[28px] sm:text-[40px] font-semibold leading-[1.1] tracking-[-0.02em]"
            initial="hidden"
            animate="shown"
            transition={{ staggerChildren: 0.12 }}
        >
            <motion.span
                className="text-white/45"
                variants={lineAnimation}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                None of the sweat.
            </motion.span>
            <motion.span
                className="text-white"
                variants={lineAnimation}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                All of the <span className="text-strava">flex.</span>
            </motion.span>
        </motion.h1>
    );
}
