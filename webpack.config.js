const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const packageJson = require('./package.json');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const deploymentMode = env?.DEPLOYMENT_MODE || 'opensource'; // 'opensource' or 'marketplace'

  console.log('🔧 Building with:', {
    mode: argv.mode || 'development',
    deploymentMode,
    isProduction
  });

  // Configuration based on deployment mode
  const config = {
    development: {
      clientId: 'YOUR_GOOGLE_CLIENT_ID_HERE',
      apiBaseUrl: 'http://localhost:8765',
      enableOAuth: false
    },
    production: {
      clientId: 'YOUR_GOOGLE_CLIENT_ID_HERE', 
      apiBaseUrl: 'http://localhost:8765',
      enableOAuth: false
    }
  };

  const currentConfig = isProduction ? config.production : config.development;

  return {
    mode: argv.mode || 'development',
    devtool: isProduction ? false : 'inline-source-map',
    entry: {
      background: './src/background/index.ts',
      content: './src/content/index.ts',
      popup: './src/popup/index.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name]/index.js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'postcss-loader',
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    optimization: isProduction ? {
      minimize: true,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            priority: 10,
          },
        },
      },
    } : {},
    plugins: [
      new webpack.DefinePlugin({
        'process.env.APP_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.DEPLOYMENT_MODE': JSON.stringify(deploymentMode),
        'process.env.ENABLE_OAUTH': JSON.stringify(currentConfig.enableOAuth),
        'process.env.GOOGLE_CLIENT_ID': JSON.stringify(currentConfig.clientId),
        'process.env.APP_VERSION': JSON.stringify(packageJson.version),
      }),
      new MiniCssExtractPlugin({
        filename: 'styles/[name].css',
      }),
      new CopyPlugin({
        patterns: [
          {
            from: 'src/manifest.json',
            to: 'manifest.json',
            transform(content) {
              const manifest = JSON.parse(content.toString());
              // Update version from package.json
              manifest.version = packageJson.version;

              if (currentConfig.enableOAuth && currentConfig.clientId) {
                manifest.oauth2 = {
                  client_id: currentConfig.clientId,
                  scopes: ["openid", "email", "profile"]
                };
              }

              return JSON.stringify(manifest, null, 2);
            },
          },
          { from: 'src/icons', to: 'icons' },
          { from: 'src/popup/index.html', to: 'popup/index.html' },
        ],
      }),
    ],
  };
};