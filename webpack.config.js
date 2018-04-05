const path = require('path');

module.exports = {
    entry: {
        kulturminne: './examples/kulturminne.js',
        brukerminner: './examples/brukerminner.js'
    },
    devtool: 'inline-source-map',
    devServer: {
        publicPath: '/script/',
        port: 9001,
        contentBase: path.join(__dirname, 'examples')
    },
    node: {
        console: true,
        fs: 'empty',
        net: 'empty',
        tls: 'empty',
        dns: 'empty',
        dgram: 'empty'
    },
    output: {
         path: path.resolve(__dirname, 'dist'),
         filename: '[name].js'
     },
     module: {
         loaders: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader'
            }/*,
            {
                test: require.resolve('jquery'),
                use: [
                        {
                            loader: 'expose-loader',
                            options: '$'
                        }
                    ]
            }/*,
            {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: 'url-loader'
            },
            {
                test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: 'url-loader'
            }*/
        ]
    }
};