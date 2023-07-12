import { Plugin, Toypack, Asset } from "toypack/types";
import sassLoader from "./loader.js";
import * as sass from "sass.js";
import path from "path-browserify";
import { ERRORS } from "toypack/utils";

type DepMap = Record<string, Set<string>>;

const bundlersMap: Record<
   string,
   {
      bundler: Toypack;
      depMap: DepMap;
   }
> = {};

sass.importer((request: any, done: Function) => {
   const split = request.previous.split(".");
   const bundlerId = split[0];
   const { bundler, depMap } = bundlersMap[bundlerId];
   const importer = split.slice(1).join(".");
   const sourceToResolve = request.current;
   const resolvedSource = bundler.resolve(sourceToResolve, {
      baseDir: path.dirname(importer),
   });
   const resolvedAsset = bundler.getAsset(resolvedSource || "");
   if (!resolvedAsset) {
      done({
         error: ERRORS.resolveFailure(sourceToResolve, importer),
      });
   } else {
      depMap[importer] ??= new Set();
      depMap[importer].add(resolvedAsset.source);
      const resolvedContent = resolvedAsset.content || "";
      done({
         content: resolvedContent,
      });
   }
});

function setDepImporterModifiedFlagToTrue(
   bundler: Toypack,
   depMap: DepMap,
   depSource: string
) {
   for (const [importer, imports] of Object.entries(depMap)) {
      if (imports.has(depSource)) {
         const importerAsset = bundler.getAsset(importer);
         if (!importerAsset) return;
         importerAsset.modified = true;
      }
   }
}

export default function (): Plugin {
   let bundler: Toypack;
   let depMap: DepMap;

   return {
      name: "sass-plugin",
      extensions: [
         ["style", ".sass"],
         ["style", ".scss"],
      ],
      loaders: [sassLoader()],
      setup() {
         bundler = this.bundler;
         depMap = this.setCache<DepMap>("depMap", {});
         bundlersMap[bundler.id] = {
            bundler,
            depMap,
         };

         /**
          * The sass compiler merges the dependencies of a sass file in it.
          * Having said that, we need to check for dependency changes ourselves
          * because a sass file won't get recompiled unless the file itself
          * changes. We don't want this to happen because if one of its
          * dependency file changes, the main sass file will still use the
          * old contents of that dependency.
          *
          * Solution:
          * If a module was modified, and that module is a dependency of a
          * sass file. We need to manually mark its importer's asset to
          * modified so that it can be recompiled.
          */
         bundler.onAddOrUpdateAsset((event) => {
            const asset: Asset = event.asset;
            setDepImporterModifiedFlagToTrue(bundler, depMap, asset.source);
         });

         // Remove in map if deleted
         bundler.onRemoveAsset((event) => {
            const asset: Asset = event.asset;
            setDepImporterModifiedFlagToTrue(bundler, depMap, asset.source);

            if (asset.source in depMap) {
               delete depMap[asset.source];
            }
         });
      },
   };
}
