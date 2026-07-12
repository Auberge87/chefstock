export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="box" style={{ textAlign: 'center', padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p className="small">Cet écran n'est pas encore porté vers la nouvelle application.</p>
    </div>
  )
}
