import { Loader } from "toypack/types";
import * as sass from "sass.js";

function compileSass(
   source: string,
   content: string,
   isIndentedSyntax: boolean,
   bundlerId: string
): Promise<any> {
   return new Promise((resolve) => {
      sass.compile(
         content,
         {
            indentedSyntax: isIndentedSyntax,
            /**
             * This is ugly but it's the only way we can pass the bundler
             * id to sass importer
             */
            inputPath: `${bundlerId}.${source}`,
         },
         (result: any) => {
            resolve(result);
         }
      );
   });
}

export default function (): Loader {
   return {
      test: /\.s(a|c)ss$/,
      compile: {
         async: true,
         async handler(moduleInfo) {
            if (
               typeof moduleInfo.content != "string" ||
               moduleInfo.type == "resource"
            ) {
               this.emitError("Blob contents are not supported.");
               return;
            }
            
            const result = await compileSass(
               moduleInfo.source,
               moduleInfo.content,
               moduleInfo.lang == "sass",
               this.bundler.id
            );
            
            if (result.status != 0) {
               let errorMsg = result.message;
               if (errorMsg.length) errorMsg += "\n";
               errorMsg += result.formatted.replace("Error:", "");
               this.emitError(errorMsg);
            } else {
               return {
                  content: result.text || "",
                  map: result.map,
               };
            }
         },
      },
   };
}
