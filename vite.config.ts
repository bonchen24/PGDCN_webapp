// Author: Gemini
// OS support: Web/Node
// Description: Vite configuration with React and Tailwind CSS v4 plugins

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 1357,
        host: '0.0.0.0',
        allowedHosts: ['ddtdev.tvci.id.vn'],
      },
      plugins: [react(), tailwindcss()],
      optimizeDeps: {
        include: ['emf-converter', 'react-image-crop'],
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: [
          { find: '@/LapBaoCao', replacement: path.resolve(__dirname, './LapBaoCao') },
          { find: '@/lib', replacement: path.resolve(__dirname, './LapBaoCao/lib') },
          { find: '@/components/CropperModal', replacement: path.resolve(__dirname, './LapBaoCao/components/CropperModal') },
          { find: '@/components/DeviceCombobox', replacement: path.resolve(__dirname, './LapBaoCao/components/DeviceCombobox') },
          { find: '@/components/SimpleCombobox', replacement: path.resolve(__dirname, './LapBaoCao/components/SimpleCombobox') },
          { find: '@/components/MultiSelectCombobox', replacement: path.resolve(__dirname, './LapBaoCao/components/MultiSelectCombobox') },
          { find: '@/components/EmcBepDien1VungNauForm', replacement: path.resolve(__dirname, './LapBaoCao/components/EmcBepDien1VungNauForm') },
          { find: '@/components/DayCapDienForm', replacement: path.resolve(__dirname, './LapBaoCao/components/DayCapDienForm') },
          { find: '@', replacement: path.resolve(__dirname, '.') },
        ]
      }
    };
});

// --- End of vite.config.ts ---
