"""Read only transcripts causally tied to this exact image request."""
import json
from pathlib import Path

BRAIN=Path.home()/'.gemini/antigravity-cli/brain'

def calls_from(path):
    result=[]
    for line in path.read_text(encoding='utf-8').splitlines():
        try: event=json.loads(line)
        except ValueError: continue
        for i,call in enumerate(event.get('tool_calls',[])):
            args={}
            for k,v in call.get('args',{}).items():
                try: args[k]=json.loads(v) if isinstance(v,str) else v
                except ValueError: args[k]=v
            result.append({'at':event.get('created_at'),'step':event['step_index'],
                'callIndex':i,'name':call['name'],'arguments':args})
    return result

class AgyEvidence:
    def __init__(self, request, brain=BRAIN):
        self.brain=brain; self.request=request
        self.before={p.name for p in brain.iterdir() if p.is_dir()}
        self.owned=set()

    def collect(self):
        candidates={p.name:p/'.system_generated/logs/transcript_full.jsonl'
                    for p in self.brain.iterdir() if p.is_dir() and p.name not in self.before}
        # Ownership: exact parent request; then only explicitly linked descendants.
        for _ in range(3):
            for ident,path in candidates.items():
                if not path.exists():continue
                with path.open(encoding='utf-8') as f: first=f.readline()
                try: first=json.loads(first)
                except ValueError:continue
                content=first.get('content','')
                if (first.get('type')=='USER_INPUT' and self.request in content or
                    first.get('type')=='SYSTEM_MESSAGE' and any('sender='+p+' ' in content for p in self.owned)):
                    self.owned.add(ident)
        calls=[];results=[];evidence=[]
        for ident in sorted(self.owned):
            path=candidates[ident]
            for call in calls_from(path):
                if call['name']=='generate_image':
                    row={**call,'conversation':ident}; calls.append(row); evidence.append(row)
            for line in path.read_text(encoding='utf-8').splitlines():
                try: event=json.loads(line)
                except ValueError: continue
                if event.get('type')=='GENERIC':
                    content=event.get('content','')
                    # Only structured error detection consumes these response texts.
                    results.append(content)
        return calls,results,evidence
