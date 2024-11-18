export default function LauncherPage({
  show,
  inactiveX,
  children,
}: Readonly<{
  show: boolean;
  inactiveX: number;
  children: React.ReactNode;
}>) {
  return (
    <div
      className="launcher-page"
      style={show ? { left: 0 } : { left: inactiveX * 100 + "%" }}
    >
      {children}
    </div>
  );
}
