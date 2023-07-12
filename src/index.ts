import { Plugin, Toypack, Asset, BuildHookContext } from "toypack/types";
import sassLoader from "./loader.js";
import * as sass from "sass.js";
import path from "path-browserify";
import { ERRORS } from "toypack/utils";

// const depMap: Record<string, Set<string>> = {};

export default function (): Plugin {
   let bundler: Toypack;
   let setCache: BuildHookContext["setCache"];
   let getCache: BuildHookContext["getCache"];
   let removeCache: BuildHookContext["removeCache"];

   function setDepImporterModifiedFlagToTrue(depSource: string) {
      const depMap = getCache<Record<string, Set<string>>>("depMap")!;
      for (const [importer, imports] of Object.entries(depMap)) {
         if (imports.has(depSource)) {
            const importerAsset = bundler.getAsset(importer);
            if (!importerAsset) return;
            importerAsset.modified = true;
         }
      }
   }

   sass.importer((request: any, done: Function) => {
      const sourceToResolve = request.current;
      const importer = request.previous;
      const resolvedSource = bundler.resolve(sourceToResolve, {
         baseDir: path.dirname(importer),
      });
      const resolvedAsset = bundler.getAsset(resolvedSource || "");
      if (!resolvedAsset) {
         done({
            error: ERRORS.resolveFailure(sourceToResolve, importer),
         });
      } else {
         const depMap = getCache<Record<string, Set<string>>>("depMap")!;
         depMap[importer] ??= new Set();
         depMap[importer].add(resolvedAsset.source);
         const resolvedContent = resolvedAsset.content || "";
         done({
            content: resolvedContent,
         });
      }
   });

   return {
      name: "sass-plugin",
      extensions: [
         ["style", ".sass"],
         ["style", ".scss"],
      ],
      loaders: [sassLoader()],
      setup() {
         bundler = this.bundler;
         setCache = this.setCache;
         getCache = this.getCache;
         removeCache = this.removeCache;
         setCache("depMap", {});

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
            setDepImporterModifiedFlagToTrue(asset.source);
         });

         // Remove in map if deleted
         bundler.onRemoveAsset((event) => {
            const depMap = getCache<Record<string, Set<string>>>("depMap")!;
            const asset: Asset = event.asset;
            setDepImporterModifiedFlagToTrue(asset.source);

            if (asset.source in depMap) {
               delete depMap[asset.source];
            }
         });
      },
   };
}
