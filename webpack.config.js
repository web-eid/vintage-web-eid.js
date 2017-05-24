var webpack = require('webpack')
var path = require('path')
var UnminifiedWebpackPlugin = require('unminified-webpack-plugin')

// Have multiple configurations?
module.exports = {
  entry: {
    webeid: './web-eid.js',
    deps: ['es6-promise/auto']
  },
  output: {
    path: path.join(__dirname, '/dist'),
    filename: 'web-eid.min.js',
    library: 'webeid',
    libraryTarget: 'umd'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin(),
    new webpack.optimize.CommonsChunkPlugin({name: 'deps', filename: 'web-eid-deps.min.js'}),
    new UnminifiedWebpackPlugin()
  ]
}
