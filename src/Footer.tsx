export default function Footer() {
  return (
    <footer className="mt-16 w-full py-6 bg-white/10 backdrop-blur-md border-t border-white/20">
      <div className="max-w-5xl mx-auto text-center text-white px-4">

        <h2 className="text-lg font-semibold tracking-wide">
          Youssef Shoukry
        </h2>

        <p className="text-sm opacity-80 mt-1">
          رقم الهاتف: 01204470794
        </p>

        <p className="text-sm opacity-70 mt-3">
          Developed by <span className="font-medium text-cyan-200">Youssef Shoukry</span>
        </p>

        <p className="text-xs opacity-50 mt-2">
          © {new Date().getFullYear()} All Rights Reserved
        </p>

      </div>
    </footer>
  );
}
