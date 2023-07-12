const path = require("path");

const libraryName = "ToypackSass";
module.exports = {
   mode: "production",
   entry: "./src/index.ts",
   resolve: {
      extensions: [".js", ".ts"],
      extensionAlias: {
         ".js": [".js", ".ts"],
      },
   },
   module: {
      rules: [
         {
            test: /\.ts$/,
            use: "ts-loader",
            exclude: /node_modules/,
         },
      ],
   },
   output: {
      filename: libraryName + ".js",
      path: path.resolve(__dirname, "./browser"),
      library: {
         name: libraryName,
         type: "umd",
      },
      clean: true,
   },
   devtool: "source-map",
};
