"""Replace the two authorized mutable releases after all package/channel checks."""
from pathlib import Path
import argparse,hashlib,json,os,subprocess,tempfile,zipfile
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(*args):return subprocess.check_output(args,text=True,cwd=ROOT).strip()
def api(path,data=None,method='POST'):
 if data is None:return json.loads(run('gh','api',path))
 with tempfile.NamedTemporaryFile('w',suffix='.json',delete=False) as f:
  json.dump(data,f);name=f.name
 try:return json.loads(run('gh','api',path,'--method',method,'--input',name))
 finally:Path(name).unlink()
def validate(plan):
 assert {r['edition'] for r in plan}=={'stable','beta'} and len(plan)==2
 shared=[]
 for r in plan:
  assert r['version']=={'stable':'0.3.0','beta':'0.3.1-beta'}[r['edition']]
  files={}
  for a in r['assets']:
   p=ROOT/a['path'];assert p.name==a['name'];assert sha(p)==a['sha256'];files[p.name]=p
   if p.suffix=='.zip':
    with zipfile.ZipFile(p) as z:
     assert z.testzip() is None
     if '-Setup.zip' in p.name:
      assert z.namelist()==[f"Bongo-Clawd-{r['version']}-Windows-x64-Setup.exe"]
     else:
      edition=json.loads(z.read(f"Bongo-Clawd-{r['version']}-Windows-x64/EDITION.json"))
      assert edition['edition']==r['edition'] and edition['version']==r['version']
      assert edition['source_commit']==r['source']
      assert edition['automatic_updates_experimental']==(r['edition']=='beta')
      assert edition['native_statistics_unchanged'] is True
      shared.append(edition['shared_asset_sha256'])
  assert len(files)==3
  sums=files['SHA256SUMS.txt'].read_text()
  for a in r['assets']:
   if a['name'].endswith('.zip'):assert a['sha256']+'  '+a['name'] in sums
 assert len(shared)==2 and shared[0]==shared[1], 'Shared fixes/icon differ across packages'
 print('Both editions, source commits, shared fixes/icons, ZIPs and hashes verified.',flush=True)
def main():
 p=argparse.ArgumentParser();p.add_argument('--publish',action='store_true');args=p.parse_args()
 plan=json.loads((ROOT/'releases/repair-2026-10-21.json').read_text())
 validate(plan)
 if not args.publish:return
 repo=os.environ['GITHUB_REPOSITORY'];base='repos/'+repo
 # Check BOTH releases before changing either. Preserve owner edits and unknown attachments.
 current={}
 for r in plan:
  d=api(base+'/releases/'+str(r['release_id']));assert not d['immutable'] and not d['draft']
  assert d['tag_name'] in {r['old_tag'],r['tag']}
  assert d['body'] in {r['old_body'],r['body']}, 'Owner edited release notes; refresh plan'
  assert d['name'] in {r['old_title'],r['title']}, 'Owner edited release title; refresh plan'
  allowed={a['name']:{a['digest']} for a in r['old_assets']}
  for a in r['assets']:allowed.setdefault(a['name'],set()).add('sha256:'+a['sha256'])
  for a in d['assets']:
   if a['name'] in allowed:assert a.get('digest') in allowed[a['name']], 'Unexpected existing attachment bytes'
  refs=api(base+'/git/matching-refs/tags/'+r['tag'])
  exact=[x for x in refs if x['ref']=='refs/tags/'+r['tag']]
  if exact:assert exact[0]['object']['sha'] in {r['old_source'],r['source']}, 'Tag changed since review'
  current[r['release_id']]=d
 for r in sorted(plan,key=lambda x:x['edition']=='stable'):
  d=current[r['release_id']]
  for a in r['assets']:
   found=next((x for x in d['assets'] if x['name']==a['name']),None)
   if found and found.get('digest')=='sha256:'+a['sha256']:continue
   run('gh','release','upload',d['tag_name'],str(ROOT/a['path']),'--repo',repo,'--clobber')
  fresh=api(base+'/releases/'+str(r['release_id']))
  for a in r['assets']:
   found=next(x for x in fresh['assets'] if x['name']==a['name'])
   assert found['digest']=='sha256:'+a['sha256']
  refs=api(base+'/git/matching-refs/tags/'+r['tag'])
  exact=[x for x in refs if x['ref']=='refs/tags/'+r['tag']]
  if not exact:api(base+'/git/refs',{'ref':'refs/tags/'+r['tag'],'sha':r['source']})
  elif exact[0]['object']['sha']!=r['source']:
   assert exact[0]['object']['sha']==r['old_source']
   api(base+'/git/refs/tags/'+r['tag'],{'sha':r['source'],'force':True},'PATCH')
  result=api(base+'/releases/'+str(r['release_id']),{'tag_name':r['tag'],'target_commitish':r['source'],'name':r['title'],'body':r['body'],'prerelease':r['edition']=='beta','make_latest':'true' if r['edition']=='stable' else 'false'},'PATCH')
  assert result['tag_name']==r['tag'] and result['prerelease']==(r['edition']=='beta')
  names={a['name'] for a in r['assets']}
  # Remove only superseded beta filename aliases already present in the reviewed snapshot.
  for old in r['old_assets']:
   if old['name'] in names:continue
   asset=next((x for x in result['assets'] if x['name']==old['name']),None)
   if asset:
    assert asset['digest']==old['digest']
    run('gh','api',base+'/releases/assets/'+str(asset['id']),'--method','DELETE')
  final=api(base+'/releases/'+str(r['release_id']))
  for a in r['assets']:assert next(x for x in final['assets'] if x['name']==a['name'])['digest']=='sha256:'+a['sha256']
  assert api(base+'/git/ref/tags/'+r['tag'])['object']['sha']==r['source']
  print('Replaced '+final['html_url']+' from '+r['source'],flush=True)
 assert api(base+'/releases/latest')['tag_name']=='v0.3.0'
 print('Existing release IDs retained; stable Latest and beta Pre-release verified.',flush=True)
if __name__=='__main__':main()
