import { defineConfig } from 'vite'
import monkey from 'vite-plugin-monkey'
import pkg from './package.json' with { type: 'json' }
import path from 'path'
import url from 'url'
import VitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator'
const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
export default defineConfig(({ mode }) => ({
    build: {
        minify: 'terser',
        terserOptions: {
            compress: {
                defaults: true,
                dead_code: true,
                drop_debugger: true,
                passes: 3
            },
            format: {
                comments: false,
                ecma: 5,
                wrap_iife: true
            },
            mangle: {
                properties: {
                    regex: /^_/,
                    reserved: ['$super', '_']
                }
            }
        }
    },
    esbuild: {
        drop: ['debugger']
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    plugins: [
        monkey({
            entry: 'src/main.js',
            build: {
                fileName: mode === 'development' ? `${pkg.name}-dev.user.js` : `${pkg.name}.user.js`,
                metaFileName: true
            },
            server: {
                mountGmApi: true
            },
            userscript: {
                name: '斗鱼直播间播放器置顶',
                namespace: '斗鱼直播间播放器置顶',
                copyright: pkg.author,
                license: 'GPL-3.0 License',
                version: pkg.version,
                author: pkg.author,
                description: '需与 sylus【[夜间斗鱼](https://userstyles.world/style/240/nightmode-for-douyu-com) NightMode For Douyu.com】 配合使用，可屏蔽除播放器外所有元素。',
                match: [
                    '*://*.douyu.com/0*',
                    '*://*.douyu.com/1*',
                    '*://*.douyu.com/2*',
                    '*://*.douyu.com/3*',
                    '*://*.douyu.com/4*',
                    '*://*.douyu.com/5*',
                    '*://*.douyu.com/6*',
                    '*://*.douyu.com/7*',
                    '*://*.douyu.com/8*',
                    '*://*.douyu.com/9*',
                    '*://*.douyu.com/topic/*',
                    '*://*.douyu.com/directory/myFollow',
                    '*://*.douyu.com/search/*'
                ],
                supportURL: 'https://github.com/QIUZAIYOU/Bilibili-Adjustment',
                homepageURL: 'https://www.asifadeaway.com/UserScripts/bilibili/bilibili-adjustment.user.js',
                grant: [
                    'unsafeWindow'
                ]
            }
        }),
        VitePluginBundleObfuscator({
            excludes: [],
            enable: true,
            log: false,
            autoExcludeNodeModules: false,
            threadPool: true,
            options: {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.75,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.4,
                debugProtection: true,
                debugProtectionInterval: 2000,
                disableConsoleOutput: true,
                identifierNamesGenerator: 'hexadecimal',
                numbersToExpressions: true,
                renameGlobals: true,
                selfDefending: true,
                simplify: true,
                splitStrings: true,
                splitStringsChunkLength: 5,
                stringArray: true,
                stringArrayEncoding: ['base64'],
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 2,
                stringArrayWrappersChainedCalls: true,
                transformObjectKeys: true,
                unicodeEscapeSequence: true
            }
        })
    ]
}))
