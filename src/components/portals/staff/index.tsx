"use client";
/**
 * staff.website.bh — thin composition of the Shamel staff console:
 * login gate (auth-shell, shell-login.tsx) → app-shell (shell.tsx).
 * Module screens (reception/emr/lab/billing/home/ops) are owned by
 * build agents 2-c/2-d/2-e/2-f and render unchanged inside the shell.
 */
import { useApp } from "@/store/app";
import { ShellStyle } from "./shell-identity";
import { StaffLogin } from "./shell-login";
import StaffShell from "./shell";

export default function StaffPortal() {
  const { staff } = useApp();
  return (
    <>
      <ShellStyle />
      {staff ? <StaffShell /> : <StaffLogin />}
    </>
  );
}
