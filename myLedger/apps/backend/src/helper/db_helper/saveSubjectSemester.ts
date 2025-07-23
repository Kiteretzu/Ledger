import { client as prisma } from "@repo/db/client"; // Adjust the import path as necessary

interface SubjectAttendanceItem {
  LTpercantage: number;
  Lpercentage: number | string;
  Lprepercentage: number | string;
  Lpretotalclass: number | string;
  Lpretotalpres: number | string;
  Lsubjectcomponentcode: string;
  Lsubjectcomponentid: string;
  Ltotalclass: number | string;
  Ltotalpres: number | string;

  Ppercentage: number | string;
  Pprepercentage: number | string;
  Ppretotalclass: number | string;
  Ppretotalpres: number | string;
  Psubjectcomponentcode: string;
  Psubjectcomponentid: string;
  Ptotalclass: number | string;
  Ptotalpres: number | string;

  Tpercentage: number | string;
  Tprepercentage: number | string;
  Tpretotalclass: number | string;
  Tpretotalpres: number | string;
  Tsubjectcomponentcode: string;
  Tsubjectcomponentid: string;
  Ttotalclass: number | string;
  Ttotalpres: number | string;

  abseent: number;
  individualsubjectcode: string;
  slno: number;
  subjectcode: string;
  subjectid: string;
  [key: string]: any;
}

interface IncomingSubjectSemesterResponse {
  studentattendancelist: SubjectAttendanceItem[];
}

export const saveSubjectSemester = async (
  username: string,
  data: IncomingSubjectSemesterResponse,
  semesterLabel: string
) => {
  try {
    // Step 1: Find the student by username
    const student = await prisma.student.findUnique({
      where: { username },
    });

    if (!student) {
      throw new Error("Student not found for username: " + username);
    }

    // Step 2: Find or create semester for this student
    let semester = await prisma.semester.findFirst({
      where: {
        studentId: student.id,
        label: semesterLabel,
      },
    });

    if (!semester) {
      semester = await prisma.semester.create({
        data: {
          label: semesterLabel,
          student: { connect: { id: student.id } },
        },
      });
    }

    // Step 3: Process and upsert each subject exactly as received
    for (const subj of data.response.studentattendancelist) {
      const subjectCode = subj.individualsubjectcode;
      const subjectName = subj.subjectcode;

      await prisma.subject.upsert({
        where: {
          code_semesterId: {
            code: subjectCode,
            semesterId: semester.id,
          },
        },
        update: {
          name: subjectName,
          attendance: subj, // ✅ Save exact structure
        },
        create: {
          code: subjectCode,
          name: subjectName,
          attendance: subj, // ✅ Save exact structure
          semester: { connect: { id: semester.id } },
        },
      });
    }

    console.log(
      `✅ Subjects for semester ${semesterLabel} saved for ${username}`
    );
  } catch (err) {
    console.error("❌ Error in saveSubjectSemester:", err);
    throw err;
  }
};
