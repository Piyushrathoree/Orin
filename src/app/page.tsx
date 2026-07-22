'use client'
import { useUser } from "@clerk/react";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { api  } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";


export default function Home() {
  const { isLoaded, isSignedIn, user } = useUser();
  const project = useQuery(api.projects.getProject)
  const createProject = useMutation(api.projects.createProject);
  if (!isLoaded) return <div className="p-6">Loading profile...</div>;

  

  if (!isSignedIn) {
    return (
      <div className="p-6 flex flex-col items-start gap-4">
        <p>Please sign in to view your profile.</p>
        <SignInButton>
          <button className="rounded-md bg-black px-4 py-2 text-white">
            Sign in
          </button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 text-black p-8">
      <div className="mb-4">
        <UserButton />
      </div>
      
      <p className="mt-4 text-base ">hi this is piyush testing this application</p>

      <button onClick={() => createProject({name: "hello world"})} className="rounded-md bg-black px-4 py-2 text-white">
        Click me
      </button>

    {project?.map((project) => (
      <div className="px-10 py-4 border border-black  inner-shadow mb-1" key={project._id}>
        <p> {project.name}</p>
        <p> {project.ownerId}</p>
      </div>
    ))  }

    </div>
  );
}
