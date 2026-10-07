import {createState,decision,reconcile,resolve,calendar} from './reference.mjs';

// Authored inputs only. Outcomes and complete traces are always generated.
export function branchNights(t) {
  return t.scenarios.branches.map(scenario => {
    const before=createState(t,scenario.seed,scenario.day);
    for(const [path,value] of Object.entries(scenario.setup ?? {})) {
      const keys=path.split('/'), key=keys.pop(); let parent=before;
      for(const part of keys) parent=parent[part];
      parent[key]=structuredClone(value);
    }
    const proposed=Object.entries(scenario.choices).map(([id,[intent,args]])=>decision(t,before,id,intent,args));
    if(scenario.badLine)proposed[0].line=scenario.badLine;
    const accepted=reconcile(t,before,proposed);
    return {id:scenario.id,label:'simulated',before,calendar:calendar(t,before.day),proposed,...accepted,...resolve(t,before,accepted.items)};
  });
}
